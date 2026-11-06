import { storage } from "webextension-polyfill";
import {
  SubscriptionResult,
  SubscriptionResultStatus,
  Topic,
} from "../types/extension";
import {
  BROWSER_TOPIC_CONFIGS_STORAGE_KEY,
  TOPIC_SUBSCRIPTION_MANAGER_STORAGE_KEY,
} from "./constants";
import NtfyNotificationManager from "./NtfyNotificationManager";
import { NtfyNotification } from "../types/ntfy";

type LastSeenTimes = Record<string, number>;

export default class TopicSubscriptionManager {
  private static instance: TopicSubscriptionManager;

  // Open connections, keyed by topic id
  private sockets = new Map<string, WebSocket>();

  constructor(private ntfyNotificationManager: NtfyNotificationManager) {
    if (TopicSubscriptionManager.instance) {
      return TopicSubscriptionManager.instance;
    }
    TopicSubscriptionManager.instance = this;
  }

  private unsubscribe = (topicId: string): void => {
    const socket = this.sockets.get(topicId);
    this.sockets.delete(topicId);
    socket?.close();
  };

  private async getTopicConfigs(): Promise<Topic[]> {
    const storedData = await storage.sync.get({
      [BROWSER_TOPIC_CONFIGS_STORAGE_KEY]: {},
    });
    return Object.values(
      storedData[BROWSER_TOPIC_CONFIGS_STORAGE_KEY] as Record<string, Topic>,
    );
  }

  private async getLastSeenTimes(): Promise<LastSeenTimes> {
    const storedData = await storage.local.get([
      TOPIC_SUBSCRIPTION_MANAGER_STORAGE_KEY,
    ]);
    const value = storedData?.[TOPIC_SUBSCRIPTION_MANAGER_STORAGE_KEY] as
      { lastSeen?: LastSeenTimes } | undefined;
    return value?.lastSeen || {};
  }

  private async setLastSeenTime(topicId: string, time: number) {
    const lastSeen = await this.getLastSeenTimes();
    if ((lastSeen[topicId] || 0) >= time) {
      return;
    }
    await storage.local.set({
      [TOPIC_SUBSCRIPTION_MANAGER_STORAGE_KEY]: {
        lastSeen: { ...lastSeen, [topicId]: time },
      },
    });
  }

  private getTopicQuery(since: string, token?: string): string {
    const query = new URLSearchParams({ since });
    if (token) {
      const auth = btoa(`Bearer ${token}`).replace(/=+$/, "");
      query.set("auth", auth);
    }
    return `?${query.toString()}`;
  }

  private subscribe = async (
    topicConfig: Topic,
  ): Promise<SubscriptionResult> => {
    if (this.sockets.has(topicConfig.id)) {
      return { status: SubscriptionResultStatus.SUCCESS, topic: topicConfig };
    }

    // Ask the server for everything we missed while disconnected. The time
    // filter is inclusive, so already-seen messages get de-duplicated by id.
    const lastSeen = (await this.getLastSeenTimes())[topicConfig.id];
    const since = lastSeen ? String(lastSeen) : "all";
    const socketUrl = new URL(
      `${topicConfig.name}/ws${this.getTopicQuery(since, topicConfig.token)}`,
      topicConfig.hostname,
    );
    socketUrl.protocol = socketUrl.protocol === "http:" ? "ws:" : "wss:";
    const label = `${socketUrl.host}/${topicConfig.name}`;

    return new Promise<SubscriptionResult>((resolve) => {
      const socket = new WebSocket(socketUrl);
      this.sockets.set(topicConfig.id, socket);

      socket.onmessage = async (e) => {
        try {
          const notificationData: NtfyNotification = JSON.parse(e.data);
          if (notificationData.event === "message") {
            await this.ntfyNotificationManager.publish({
              ...notificationData,
              topicId: topicConfig.id,
            });
          } else if (notificationData.event === "message_delete") {
            await this.ntfyNotificationManager.remove(
              notificationData.sequence_id || notificationData.id,
            );
          } else {
            return;
          }
          await this.setLastSeenTime(topicConfig.id, notificationData.time);
        } catch (error) {
          console.error(
            `[ntfy Viewer] Failed to handle message on ${label}`,
            error,
          );
        }
      };

      socket.onopen = () => {
        resolve({
          status: SubscriptionResultStatus.SUCCESS,
          topic: topicConfig,
        });
      };

      // Fires on failed connects (after onerror) and on later disconnects.
      // Dropping the socket lets the keepalive alarm reconnect it.
      socket.onclose = (e) => {
        console.warn(
          `[ntfy Viewer] Connection to ${label} closed (code ${e.code})`,
        );
        if (this.sockets.get(topicConfig.id) === socket) {
          this.sockets.delete(topicConfig.id);
        }
        resolve({
          status: SubscriptionResultStatus.FAILURE,
          topic: topicConfig,
        });
      };
    });
  };

  /**
   * Connects every configured topic that isn't connected yet. Safe to call
   * repeatedly; it's used both on startup and as a periodic reconnect.
   */
  subscribeAll = async () => {
    const topicConfigs = await this.getTopicConfigs();
    const topicIds = new Set(topicConfigs.map((topic) => topic.id));
    [...this.sockets.keys()]
      .filter((topicId) => !topicIds.has(topicId))
      .forEach(this.unsubscribe);
    return Promise.all(topicConfigs.map(this.subscribe));
  };

  unsubscribeAll = () => {
    [...this.sockets.keys()].forEach(this.unsubscribe);
  };
}
