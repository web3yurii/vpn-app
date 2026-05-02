// src/main/main.ts
process.title = "Anyone VPN";

import { app, globalShortcut, nativeImage, Tray, Menu, dialog } from "electron";
import { createMainWindow } from "./windows";
import { CreateHTMLTray } from "./tray";
import { setupIpcHandlers } from "./ipcHandlers";
import { checkForUpdates } from "./updater";
import { stopAnyoneProxy } from "./proxy";
import { setProxySettings } from "./systemProxy";
import { isProd } from "./constants";
import { createAppMenu } from "./app.menu";
import { initializeState, state } from "./state";
import log from 'electron-log/main';
import path from "path";

// Global error handlers
process.on('uncaughtException', (error) => {
  dialog.showErrorBox(
    'Whoops! An unexpected error occurred',
    `An unexpected error occurred. Please try restarting the app.\nError details: ${error.message}`
  );
});

process.on('unhandledRejection', (reason: any) => {
  dialog.showErrorBox(
    'Whoops! An unexpected error occurred',
    `An unexpected error occurred. Please try restarting the app.\nError details: ${reason?.message || reason}`
  );
});

// SIGINT/SIGTERM → call app.quit() so Electron's before-quit event fires.
// before-quit uses event.preventDefault() to hold the quit open while async
// cleanup runs (proxy settings + anon process), then calls app.quit() again.
let isCleaningUp = false;
process.on('SIGINT', () => { if (!isCleaningUp) app.quit(); });
process.on('SIGTERM', () => { if (!isCleaningUp) app.quit(); });

// ---- SINGLE INSTANCE LOCK ----
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindowRef = null;
  app.on('second-instance', (_event, _argv, _workingDirectory) => {
    // Someone tried to run a second instance, focus the main window.
    if (mainWindowRef) {
      if (mainWindowRef.isMinimized()) mainWindowRef.restore();
      mainWindowRef.show();
      mainWindowRef.focus();
    }
  });

  (async () => {
    app.setName("Anyone VPN");
    log.initialize({ preload: true });
    console.log = log.log;
    console.error = log.error;
    const platform = process.platform;
    if (process.platform === "darwin") {
      app.setAboutPanelOptions({
        applicationName: "Anyone VPN",
        applicationVersion: "1.0.2",
        copyright: "© 2023 Anyone VPN Inc.",
        credits: "Developed by Anyone VPN Team",
        iconPath: path.join(app.getAppPath(), "resources", "icon.png"),
      });
    }

    await app.whenReady().then(() => {
      createAppMenu();

      if (platform === "darwin") {
        const dockedIconPath = path.join(
          app.getAppPath(),
          "resources",
          "icon.png"
        );

        app.dock.setIcon(dockedIconPath);
        app.dock.setBadge("Anyone");

        app.dock.show();
      }
      app.setName("Anyone VPN");
    });

    app.name = "Anyone VPN";

    // set the icon
    // Initialize shared state
    initializeState();

    // Clear any lingering system proxy settings from a previous session that
    // crashed or was force-quit (clean exits are handled by before-quit/quit).
    // The port value is irrelevant for the "off" operation on all platforms.
    await setProxySettings(false, state.proxyPort);

    const mainWindow = createMainWindow();
    mainWindowRef = mainWindow;
    // createTray(mainWindow);
    CreateHTMLTray();

    // createTray(mainWindow);
    setupIpcHandlers(mainWindow);

    // Register global shortcuts
    let menuBarVisible = false;
    globalShortcut.register("CmdOrCtrl+Shift+M", () => {
      menuBarVisible = !menuBarVisible;
      mainWindow.setAutoHideMenuBar(!menuBarVisible);
      mainWindow.setMenuBarVisibility(menuBarVisible);
      console.log(`Menu bar is now ${menuBarVisible ? "visible" : "hidden"}`);
    });

    // Graceful shutdown: prevent the quit, clean up proxy + anon process,
    // then call app.quit() again (isCleaningUp guard prevents infinite loop).
    app.on("before-quit", async (event) => {
      if (isCleaningUp) return;
      isCleaningUp = true;
      event.preventDefault();
      try {
        await setProxySettings(false, state.proxyPort);
        if (state.anon) {
          state.isQuitting = true;
          await stopAnyoneProxy();
        }
      } catch (_) {}
      app.quit();
    });

    app.on("window-all-closed", async () => {
      if (platform === "darwin") {
        app.dock.hide();
      }
      mainWindow.hide();
    });

    app.on("will-quit", () => {
      globalShortcut.unregisterAll();
    });

    // Check for updates
    checkForUpdates();
  })();
}

export { app };
