import { alarms } from "webextension-polyfill";
import BadgeNumberManager from "./utils/BadgeNumberManager";
import NtfyNotificationManager from "./utils/NtfyNotificationManager";
import BrowserNotificationManager from "./utils/BrowserNotificationManager";
import TopicSubscriptionManager from "./utils/TopicSubscriptionManager";
import BackgroundMessageHandler from "./utils/messages/BackgroundMessageHandler";
import ErrorHandler from "./utils/ErrorHandler";
import { KEEPALIVE_ALARM_NAME } from "./utils/constants";

async function init() {
  const badgeNumberManager = await BadgeNumberManager.init();
  badgeNumberManager.startListeners();
  const ntfyNotificationManager =
    await NtfyNotificationManager.init(badgeNumberManager);
  const browserNotificationManager = new BrowserNotificationManager();
  const errorHandler = new ErrorHandler(browserNotificationManager);
  const topicSubscriptionManager = new TopicSubscriptionManager(
    ntfyNotificationManager,
  );
  const backgroundMessageHandler = new BackgroundMessageHandler(
    topicSubscriptionManager,
    errorHandler,
  );

  browserNotificationManager.startListeners();
  ntfyNotificationManager.startListeners();
  topicSubscriptionManager.subscribeAll();
  backgroundMessageHandler.init();

  return topicSubscriptionManager;
}

const initialized = init();

// The MV3 service worker is stopped after ~30s without extension events, which
// drops the topic connections. A periodic alarm keeps it awake (or wakes
// it back up, re-running init above), and reconnects any dropped topics.
// The listener must be registered synchronously for the alarm to wake the worker.
alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM_NAME) return;
  const topicSubscriptionManager = await initialized;
  await topicSubscriptionManager.subscribeAll();
});
alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: 0.5 });
