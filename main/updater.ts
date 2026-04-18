// src/main/updater.ts
import { autoUpdater } from "electron-updater";
import Store from "electron-store";
import { state } from "./state";
import { checkIP } from "./utils";
import { getRelayData } from "./proxy";

const store = new Store();

export function checkForUpdates() {
  return;
  const autoUpdateEnabled = store.get("autoUpdateEnabled", true);
  autoUpdater.autoDownload = autoUpdateEnabled as boolean;
  autoUpdater.checkForUpdates();
}

// Auto-updater event handlers
autoUpdater.on("update-available", () => {
  const autoUpdateEnabled = store.get("autoUpdateEnabled", true);
  if (!autoUpdateEnabled) {
    state.mainWindow?.webContents.send("update_available");
    state.tray?.window?.webContents.send("update_available");
  }
});

autoUpdater.on("update-downloaded", () => {
  const autoUpdateEnabled = store.get("autoUpdateEnabled", true);
  if (autoUpdateEnabled) {
    autoUpdater.quitAndInstall();
  } else {
    state.mainWindow?.webContents.send("update_downloaded");
    state.tray?.window?.webContents.send("update_downloaded");
  }
});

export async function checkIPsAndRelay() {
  if (state.isProxyRunning) {
    const newProxyIp = await checkIP(true);
    if (newProxyIp !== state.proxyIp) {
      state.proxyIp = newProxyIp;
      state.mainWindow?.webContents.send("proxy-ip-changed", state.proxyIp);
      state.tray?.window?.webContents.send("proxy-ip-changed", state.proxyIp);
      // wait 2 seconds to get the relay ip location
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        console.log("THIS IS BEING CALLED");
        const newRelayData = await getRelayData();
        if (newRelayData.ip !== state.relayIp || newRelayData.fingerprint !== state.relayData?.fingerprint) {
          state.relayIp = newRelayData.ip;
          state.relayData = newRelayData;
          const relayLocation = state.fingerprintData.get(newRelayData.fingerprint);

          state.mainWindow?.webContents.send("relay-ip-changed", relayLocation, newRelayData);
          state.tray?.window?.webContents.send("relay-ip-changed", relayLocation, newRelayData);
        }
      } catch (error) {
        console.error("Error getting relay data:", error);
      }
    }
  }
}

// Remove the setInterval and call the function once
checkIPsAndRelay();
