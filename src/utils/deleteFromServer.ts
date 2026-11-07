import { storage } from "webextension-polyfill";
import { Topic } from "../types/extension";
import { NtfyNotification } from "../types/ntfy";
import { BROWSER_TOPIC_CONFIGS_STORAGE_KEY } from "./constants";

async function getTopicConfigs(): Promise<Topic[]> {
  const storedData = await storage.sync.get({
    [BROWSER_TOPIC_CONFIGS_STORAGE_KEY]: {},
  });
  return Object.values(
    storedData[BROWSER_TOPIC_CONFIGS_STORAGE_KEY] as Record<string, Topic>,
  );
}

/**
 * Deletes notifications on their ntfy server (DELETE /<topic>/<sequence_id>).
 * The server then sends a message_delete event to every subscribed client,
 * which is what removes them from this extension's list as well.
 *
 * @returns the notifications that could not be deleted
 */
export default async function deleteFromServer(
  notifications: NtfyNotification[],
): Promise<NtfyNotification[]> {
  const topicConfigs = await getTopicConfigs();
  const sequenceIds = new Set<string>();

  const results = await Promise.all(
    notifications.map(async (notification) => {
      const sequenceId = notification.sequence_id || notification.id;
      const topicConfig =
        topicConfigs.find((topic) => topic.id === notification.topicId) ||
        topicConfigs.find((topic) => topic.name === notification.topic);
      if (!topicConfig) return notification;
      // Several cached messages can share a sequence; delete it once
      if (sequenceIds.has(`${topicConfig.id}/${sequenceId}`)) return null;
      sequenceIds.add(`${topicConfig.id}/${sequenceId}`);

      try {
        const url = new URL(
          `${encodeURIComponent(notification.topic)}/${encodeURIComponent(sequenceId)}`,
          topicConfig.hostname.endsWith("/")
            ? topicConfig.hostname
            : `${topicConfig.hostname}/`,
        );
        const response = await fetch(url, {
          method: "DELETE",
          headers: topicConfig.token
            ? { Authorization: `Bearer ${topicConfig.token}` }
            : {},
        });
        if (!response.ok) {
          console.error(
            `[ntfy Viewer] Deleting ${sequenceId} failed: HTTP ${response.status}`,
            await response.text(),
          );
          return notification;
        }
        return null;
      } catch (error) {
        console.error(`[ntfy Viewer] Deleting ${sequenceId} failed`, error);
        return notification;
      }
    }),
  );

  return results.filter((result): result is NtfyNotification => !!result);
}
