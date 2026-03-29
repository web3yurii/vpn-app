import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { RelayData } from "./state";
import { ProxyRule } from "./proxy";

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value);
  },

  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  // Add methods for invoking IPC calls
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args);
  },
  // Specific methods for startProxy, stopProxy, checkIP
  startProxy() {
    return ipcRenderer.invoke("start-proxy");
  },
  stopProxy() {
    return ipcRenderer.invoke("stop-proxy");
  },
  checkIP(useProxy: boolean) {
    return ipcRenderer.invoke("check-ip", useProxy);
  },
  // Event listeners for proxy events
  onProxyStarted(callback: () => void) {
    const subscription = () => callback();
    ipcRenderer.on("proxy-started", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-started", subscription);
    };
  },
  onProxyStopped(callback: () => void) {
    const subscription = () => callback();
    ipcRenderer.on("proxy-stopped", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-stopped", subscription);
    };
  },
  onProxyError(callback: (message: string) => void) {
    const subscription = (_event: IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("proxy-error", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-error", subscription);
    };
  },
  onAnonRunningError(callback: (message: string) => void) {
    const subscription = (_event: IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("anon-running-error", subscription);
    return () => {
      ipcRenderer.removeListener("anon-running-error", subscription);
    };
  },
  // Event listeners for update events
  onUpdateAvailable(callback: () => void) {
    const subscription = () => callback();
    ipcRenderer.on("update_available", subscription);
    return () => {
      ipcRenderer.removeListener("update_available", subscription);
    };
  },
  onUpdateDownloaded(callback: () => void) {
    const subscription = () => callback();
    ipcRenderer.on("update_downloaded", subscription);
    return () => {
      ipcRenderer.removeListener("update_downloaded", subscription);
    };
  },
  //real-ip-changed
  onRealIPChanged(callback: (ip: string) => void) {
    const subscription = (_event: IpcRendererEvent, ip: string) => callback(ip);
    ipcRenderer.on("real-ip-changed", subscription);
    return () => {
      ipcRenderer.removeListener("real-ip-changed", subscription);
    };
  },

  //proxy-ip-changed
  onProxyIPChanged(callback: (ip: string) => void) {
    const subscription = (_event: IpcRendererEvent, ip: string) => callback(ip);
    ipcRenderer.on("proxy-ip-changed", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-ip-changed", subscription);
    };
  },

  //on-relay-ip-changed
  onRelayIPChanged(callback: (relayData: RelayData) => void) {
    const subscription = (_event: IpcRendererEvent, relayData: RelayData) => callback(relayData);
    ipcRenderer.on("relay-ip-changed", subscription);
    return () => {
      ipcRenderer.removeListener("relay-ip-changed", subscription);
    };
  },

  onProxyProgress(callback: (progress: number, message: string) => void) {
    const subscription = (_event: IpcRendererEvent, progress: number, message: string) => callback(progress, message);
    ipcRenderer.on("proxy-progress", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-progress", subscription);
    };
  },

  onProxyComplete(callback: (complete: boolean) => void) {
    const subscription = (_event: IpcRendererEvent, complete: boolean) => callback(complete);
    ipcRenderer.on("proxy-complete", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-complete", subscription);
    };
  },

  // Circuit failure events
  onCircuitFailure(callback: (data: { circuitId: string; target: string; timestamp: string }) => void) {
    const subscription = (_event: IpcRendererEvent, data: { circuitId: string; target: string; timestamp: string }) => callback(data);
    ipcRenderer.on("circuit-failure", subscription);
    return () => {
      ipcRenderer.removeListener("circuit-failure", subscription);
    };
  },

  onCircuitRecreated(callback: (data: { oldCircuitId: string; newCircuitId: number; target: string; timestamp: string }) => void) {
    const subscription = (_event: IpcRendererEvent, data: { oldCircuitId: string; newCircuitId: number; target: string; timestamp: string }) => callback(data);
    ipcRenderer.on("circuit-recreated", subscription);
    return () => {
      ipcRenderer.removeListener("circuit-recreated", subscription);
    };
  },

  onCircuitCreated(callback: (data: { newCircuitId: number; target: string; timestamp: string }) => void) {
    const subscription = (_event: IpcRendererEvent, data: { newCircuitId: number; target: string; timestamp: string }) => callback(data);
    ipcRenderer.on("circuit-created", subscription);
    return () => {
      ipcRenderer.removeListener("circuit-created", subscription);
    };
  },

  onCircuitPathUpdated(callback: (data: { circuitId: number; target: string; hopCountries: string[]; hopCoordinates: Array<{ latitude: number; longitude: number } | null> }) => void) {
    const subscription = (_event: IpcRendererEvent, data: { circuitId: number; target: string; hopCountries: string[] }) => callback(data);
    ipcRenderer.on("circuit-path-updated", subscription);
    return () => {
      ipcRenderer.removeListener("circuit-path-updated", subscription);
    };
  },

  // window-resize
  onWindowResize: (callback: (height: number, width: number) => void) => {
    const subscription = (_event: IpcRendererEvent, height: number, width: number) => {
      callback(height, width);
    };

    ipcRenderer.on("window-resize", subscription);

    return () => {
      ipcRenderer.removeListener("window-resize", subscription);
    };
  },

  restartApp: () => ipcRenderer.send("restart_app"),
  getAutoUpdatePreference: () =>
    ipcRenderer.invoke("get-auto-update-preference"),
  setAutoUpdatePreference: (enabled: boolean) =>
    ipcRenderer.invoke("set-auto-update-preference", enabled),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  getGroupedConnectedProcesses: (port: number) =>
    ipcRenderer.invoke("get-grouped-connected-processes", port),

  setAutoLaunch: (enable: boolean) =>
    ipcRenderer.invoke("set-auto-launch", enable),
  isAutoLaunchEnabled: () => ipcRenderer.invoke("is-auto-launch-enabled"),
  openSettingsWindow: () => ipcRenderer.invoke("open-settings-window"),
  closeSettingsWindow: () => ipcRenderer.invoke("close-settings-window"),
  hideSettingsWindow: () => ipcRenderer.invoke("hide-settings-window"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  closeApp: () => ipcRenderer.invoke("close-app"),
  minimizeApp: () => ipcRenderer.invoke("minimize-app"),
  expandApp: () => ipcRenderer.invoke("expand-app"),
  minimizeExpandedApp: () => ipcRenderer.invoke("minimize-expanded-app"),
  getGeolocation: (ip: string) => ipcRenderer.invoke("get-geolocation", ip),
getIcon: (iconPath) => ipcRenderer.invoke("get-icon", iconPath),
  getRelayData: () => ipcRenderer.invoke("get-relay-data"),
  getRealIP: () => ipcRenderer.invoke("get-real-ip"),
  getProxyIP: () => ipcRenderer.invoke("get-proxy-ip"),
  onProxyStats: (
    callback: (stats: { download: string; upload: string }) => void
  ) => {
    const subscription = (
      _event: IpcRendererEvent,
      stats: { download: string; upload: string } // Change to expect strings
    ) => callback(stats);

    ipcRenderer.on("proxy-stats", subscription);

    return () => {
      ipcRenderer.removeListener("proxy-stats", subscription);
    };
  },
  isProxyRunning: () => ipcRenderer.invoke("is-proxy-running"),
  showMainWindow: () => ipcRenderer.invoke("show-main-window"),
  getProxyPort: () => ipcRenderer.invoke("get-proxy-port"),
  getAnonPort: () => ipcRenderer.invoke("get-anon-port"),
  changeProxyPort: (port: number) =>
    ipcRenderer.invoke("change-proxy-port", port),
  changeAnonPort: (port: number) => ipcRenderer.invoke("change-anon-port", port),
  // on proxy change
  onProxyPortChanged: (callback: (port: number) => void) => {
    const subscription = (_event: IpcRendererEvent, port: number) =>
      callback(port);
    ipcRenderer.on("proxy-port-changed", subscription);
    return () => {
      ipcRenderer.removeListener("proxy-port-changed", subscription);
    };
  },
  onAnonPortChanged: (callback: (port: number) => void) => {
    const subscription = (_event: IpcRendererEvent, port: number) =>
      callback(port);
    ipcRenderer.on("anon-port-changed", subscription);
    return () => {
      ipcRenderer.removeListener("anon-port-changed", subscription);
    };
  },
  getScreenSize: () => ipcRenderer.invoke("get-screen-size"),
  addNewProxyRule: (rule: Omit<ProxyRule, 'id'>) => ipcRenderer.invoke("add-proxy-rule", rule),
  editProxyRule: (rule: ProxyRule) => ipcRenderer.invoke("edit-proxy-rule", rule),
  deleteProxyRule: (ruleId: string) => ipcRenderer.invoke("delete-proxy-rule", ruleId),
  toggleProxyRule: (ruleId: string) => ipcRenderer.invoke("toggle-proxy-rule", ruleId),
  toggleAllProxyRules: (enabled: boolean) => ipcRenderer.invoke("toggle-all-proxy-rules", enabled),
  getProxyRules: () => ipcRenderer.invoke("get-proxy-rules"),
  getAvailableCountries: (): Promise<string[]> => ipcRenderer.invoke("get-available-countries"),
  getGlobalExitCountry: (): Promise<string | null> => ipcRenderer.invoke("get-global-exit-country"),
  setGlobalExitCountry: (country: string | null) => ipcRenderer.invoke("set-global-exit-country", country),
  onGlobalExitCountryChanged: (callback: (country: string | null) => void) => {
    const subscription = (_event: IpcRendererEvent, country: string | null) => callback(country);
    ipcRenderer.on("global-exit-country-changed", subscription);
    return () => ipcRenderer.removeListener("global-exit-country-changed", subscription);
  },
  killAnonProcess: () => ipcRenderer.invoke("kill-anon-process"),
  getShowAnimations: () => ipcRenderer.invoke("get-show-animations"),
  setShowAnimations: (showAnimations: boolean) => ipcRenderer.invoke("set-show-animations", showAnimations),
  isMainWindowMinimized: () => ipcRenderer.invoke("is-main-window-minimized"),
};

contextBridge.exposeInMainWorld("ipc", handler);
contextBridge.exposeInMainWorld("darkMode", {
  toggle: () => ipcRenderer.invoke("dark-mode:toggle"),
  system: () => ipcRenderer.invoke("dark-mode:system"),
});

console.log("Preload script loaded");

export type IpcHandler = typeof handler;
export type IpcRenderer = typeof ipcRenderer;
