import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import BadgeNumberManager from "./utils/BadgeNumberManager";
import { i18n, runtime, storage } from "webextension-polyfill";
import { NTFY_NOTIFICATION_MANAGER_STORAGE_KEY } from "./utils/constants";
import AppBar from "./components/AppBar";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ThemeProvider,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PopupContent from "./components/PopupContent";
import SettingsIcon from "@mui/icons-material/Settings";
import theme from "./utils/theme";
import Loader from "./components/Loader";
import NtfyNotificationManager from "./utils/NtfyNotificationManager";
import { NtfyNotification } from "./types/ntfy";
import deleteFromServer from "./utils/deleteFromServer";

const Popup = () => {
  const [badgeNumberManager, setBadgeNumberManager] =
    useState<BadgeNumberManager>();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NtfyNotification[]>([]);
  const [ntfyNotificationManager, setNtfyNotificationManager] =
    useState<NtfyNotificationManager>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    BadgeNumberManager.init()
      .then((badgeManager) => {
        badgeManager.startListeners();
        setBadgeNumberManager(badgeManager);

        return NtfyNotificationManager.init(badgeManager);
      })
      .then((ntfyManager) => {
        setNtfyNotificationManager(ntfyManager);
        setNotifications(ntfyManager.getAll());
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // Keep the list in sync while the popup is open (new messages, and
  // deletes coming from the server or other clients)
  useEffect(() => {
    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      const newValue = changes[NTFY_NOTIFICATION_MANAGER_STORAGE_KEY]
        ?.newValue as { notificationCache?: NtfyNotification[] } | undefined;
      if (!newValue?.notificationCache) return;
      setNotifications([...newValue.notificationCache].reverse());
    };
    storage.local.onChanged.addListener(onChanged);
    return () => storage.local.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    if (!badgeNumberManager) return;
    badgeNumberManager.reset();
  }, [badgeNumberManager]);

  const deleteAll = async () => {
    if (!ntfyNotificationManager) return;
    setDeleting(true);
    try {
      const failed = await deleteFromServer(notifications);
      const deleted = notifications.filter(
        (notification) => !failed.includes(notification),
      );
      for (const notification of deleted) {
        await ntfyNotificationManager.remove(
          notification.sequence_id || notification.id,
        );
      }
      setFailedCount(failed.length);
      setNotifications(ntfyNotificationManager.getAll());
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const openOptions = () => {
    if (runtime.openOptionsPage) {
      runtime.openOptionsPage();
    } else {
      window.open(runtime.getURL("options.html"));
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <Loader />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div style={{ minWidth: "490px" }}>
        <AppBar title="ntfy">
          <IconButton onClick={openOptions} color="inherit">
            <SettingsIcon />
          </IconButton>
        </AppBar>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {i18n.getMessage("popupNotificationsTitle")}
          </Typography>
          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteOutlineIcon />}
            disabled={!notifications.length}
            onClick={() => setConfirmOpen(true)}
          >
            {i18n.getMessage("popupDeleteAll")}
          </Button>
        </Box>
        {!!failedCount && (
          <Alert
            severity="error"
            sx={{ mx: 2, mb: 1 }}
            onClose={() => setFailedCount(0)}
          >
            {i18n.getMessage("popupDeleteAllFailed", String(failedCount))}
          </Alert>
        )}
        {notifications.length ? (
          <PopupContent notifications={notifications} />
        ) : (
          <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
            {i18n.getMessage("popupEmpty")}
          </Typography>
        )}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>
            {i18n.getMessage("popupDeleteAllConfirmTitle")}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {i18n.getMessage("popupDeleteAllConfirmMessage")}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
              {i18n.getMessage("popupDeleteAllCancel")}
            </Button>
            <Button color="error" onClick={deleteAll} disabled={deleting}>
              {i18n.getMessage("popupDeleteAll")}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </ThemeProvider>
  );
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
