import {
  Notifications,
  notifications,
  tabs,
  storage,
} from "webextension-polyfill";
import { BadgeNumberManagerInterface } from "./BadgeNumberManager";
import { NtfyNotification } from "../types/ntfy";
import { NTFY_NOTIFICATION_MANAGER_STORAGE_KEY } from "./constants";

export default class NtfyNotificationManager {
  private static instance: NtfyNotificationManager;

  private notificationCache: NtfyNotification[] = [];

  private constructor(
    private badgeNumberManager: BadgeNumberManagerInterface,
  ) {}

  static async init(
    badgeNumberManager: BadgeNumberManagerInterface,
    reset = false,
  ) {
    if (!reset && NtfyNotificationManager.instance) {
      return NtfyNotificationManager.instance;
    }
    NtfyNotificationManager.instance = new NtfyNotificationManager(
      badgeNumberManager,
    );

    const storageValue = await storage.local.get([
      NTFY_NOTIFICATION_MANAGER_STORAGE_KEY,
    ]);
    const value = storageValue?.[NTFY_NOTIFICATION_MANAGER_STORAGE_KEY];
    if (value) {
      NtfyNotificationManager.instance.notificationCache =
        value.notificationCache;
    }

    return NtfyNotificationManager.instance;
  }

  private getNotificationById(notificationId: string) {
    return this.notificationCache.find(
      (notification) => notification.id === notificationId,
    );
  }

  getAll() {
    return [...this.notificationCache].reverse();
  }

  private async addToCache(notification: NtfyNotification) {
    this.notificationCache.push(notification);

    // Remove the oldest notification when the limit is reached
    // TODO: make this configurable?
    if (this.notificationCache.length > 50) {
      this.notificationCache.shift();
    }

    await this.saveCache();
  }

  private async saveCache() {
    const storageValue = await storage.local.get([
      NTFY_NOTIFICATION_MANAGER_STORAGE_KEY,
    ]);
    const classStorageValue =
      storageValue?.[NTFY_NOTIFICATION_MANAGER_STORAGE_KEY] || {};
    await storage.local.set({
      [NTFY_NOTIFICATION_MANAGER_STORAGE_KEY]: {
        ...classStorageValue,
        notificationCache: this.notificationCache,
      },
    });
  }

  /**
   *
   * @param notificationId the ID of the notification
   * @returns true if click was handled correctly, false if notification was not found
   */
  private async onClick(notificationId: string): Promise<boolean> {
    const notification = this.getNotificationById(notificationId);
    if (!notification) {
      return false;
    }

    if (!notification.click && !notification.attachment?.url) {
      return true;
    }

    await tabs.create({
      url: notification.click || notification.attachment?.url,
    });
    return true;
  }

  private getBaseNotificationOptions(
    notification: NtfyNotification,
  ): Omit<Notifications.CreateNotificationOptions, "type"> {
    let priority = (notification.priority || 0) - 3;
    if (priority < 0) {
      priority = 0;
    }

    return {
      iconUrl: "../ntfy-512.png",
      title: notification.title || notification.topic,
      message: notification.message || "",
      priority,
      eventTime: notification.time * 1000,
      isClickable: !!notification.click,
    };
  }

  private getNotificationOptions(
    notification: NtfyNotification,
  ): Notifications.CreateNotificationOptions {
    if (
      notification.attachment &&
      notification.attachment.type.startsWith("image/")
    ) {
      return {
        type: "image",
        imageUrl: notification.attachment.url,
        ...this.getBaseNotificationOptions(notification),
      };
    }

    return {
      type: "basic",
      ...this.getBaseNotificationOptions(notification),
    };
  }

  async publish(notification: NtfyNotification) {
    // Reconnecting re-fetches recent messages; don't show them twice
    if (this.getNotificationById(notification.id)) {
      return;
    }

    await notifications.create(
      notification.id,
      this.getNotificationOptions(notification),
    );
    await this.addToCache(notification);

    await this.badgeNumberManager.higher();
  }

  /**
   * Removes every cached notification in the given sequence (used when the
   * server reports it was deleted) and closes its desktop notification.
   */
  async remove(sequenceId: string) {
    const toRemove = this.notificationCache.filter(
      (notification) =>
        (notification.sequence_id || notification.id) === sequenceId,
    );
    if (!toRemove.length) return;

    this.notificationCache = this.notificationCache.filter(
      (notification) => !toRemove.includes(notification),
    );
    await Promise.all(
      toRemove.map((notification) => notifications.clear(notification.id)),
    );
    await this.saveCache();
    for (let i = 0; i < toRemove.length; i++) {
      await this.badgeNumberManager.lower();
    }
  }

  startListeners() {
    notifications.onClicked.addListener(async (notificationId: string) => {
      const onClickResult = await this.onClick(notificationId);
      if (onClickResult) {
        await this.badgeNumberManager.lower();
      }
    });

    storage.local.onChanged.addListener((changes) => {
      const newValue = changes[NTFY_NOTIFICATION_MANAGER_STORAGE_KEY]?.newValue;
      if (!newValue) return;

      this.notificationCache = newValue.notificationCache;
    });
  }
}
