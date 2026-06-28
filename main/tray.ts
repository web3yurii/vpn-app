import { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { startAnyoneProxy, stopAnyoneProxy } from "./proxy";
import { state } from "./state";
import { setProxySettings } from "./systemProxy";
import { isProd } from "./constants";
import { menubar } from "menubar";
import { setupIpcHandlers } from "./ipcHandlers";

export function UpdateTrayIcon() {
  const iconPath = state.isProxyRunning
    ? path.join(app.getAppPath(), "resources", "tray-blue.png")
    : path.join(app.getAppPath(), "resources", "tray-red.png");

  const icon = nativeImage.createFromPath(iconPath);
  state.tray?.tray?.setImage(icon);
}

// export function createTray(mainWindow: BrowserWindow) {
//   function updateTrayIcon() {
//     const iconPath = state.isProxyRunning
//       ? path.join(app.getAppPath(), "resources", "tray-blue.png")
//       : path.join(app.getAppPath(), "resources", "tray-red.png");

//     const icon = nativeImage.createFromPath(iconPath);
//     state.tray.setImage(icon);
//   }

//   function updateContextMenu() {
//     const contextMenu = Menu.buildFromTemplate([
//       {
//         label: "Show App",
//         click: () => {
//           mainWindow.show();
//         },
//       },
//       ...(state.proxyIp
//         ? [
//             {
//               label: `Proxy IP: ${state.proxyIp}`,
//               click: () => {
//                 mainWindow.show();
//               },
//             },
//           ]
//         : []),
// {
//   label: "Start Proxy",
//   enabled: !state.isProxyRunning, // Disable if proxy is running
//   click: async () => {
//     await startAnyoneProxy();
//     state.isProxyRunning = true;
//     updateTrayIcon();
//     updateContextMenu();
//   },
// },
// {
//   label: "Stop Proxy",
//   enabled: state.isProxyRunning, // Disable if proxy is not running
//   click: async () => {
//     await stopAnyoneProxy();
//     state.isProxyRunning = false;
//     updateTrayIcon();
//     updateContextMenu();
//   },
// },
//       {
//         label: "Quit",
//         click: async () => {
//           setProxySettings(false, state.proxyPort);
//           await stopAnyoneProxy();

//           app.quit();
//           app.exit();
//         },
//       },
//     ]);

//     state.tray.setContextMenu(contextMenu);
//   }

//   const initialIconPath = path.join(
//     app.getAppPath(),
//     state.isProxyRunning ? "resources/tray-blue.png" : "resources/tray-red.png"
//   );
//   const tray = new Tray(nativeImage.createFromPath(initialIconPath));

//   tray.setToolTip("Anyone-VPN App");
//   state.tray = tray;
//   ipcMain.on("proxy:stateChanged", (_event, isRunning) => {
//     state.isProxyRunning = isRunning;
//     updateTrayIcon();
//     updateContextMenu();
//   });
//   ipcMain.on("proxy:ipChanged", (_event, ip) => {
//     state.proxyIp = ip;
//     updateContextMenu();
//   });
//   updateContextMenu();
// }

export const CreateHTMLTray = () => {
  const port = process.argv[2];
  const mb = menubar({
    browserWindow: {
      width: 250,
      height: 400,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: true,
      },
    },
    preloadWindow: true,
    index: isProd ? "app://./tray/index.html" : `http://localhost:${port}/tray`,
    icon: path.join(app.getAppPath(), "resources", "tray-red.png"),
  });

  mb.on("ready", () => {
    state.tray = mb;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Quit",
        click: async () => {
          if (state.isProxyRunning) {
            await stopAnyoneProxy();
          }
          await setProxySettings(false, state.proxyPort);
          app.quit();
        },
      },
    ]);

    // Show context menu only on right-click
    mb.tray.on("right-click", () => {
      mb.tray.popUpContextMenu(contextMenu);
    });

    // Optionally, handle left-click to show/hide your window
    mb.tray.on("click", () => {
      const mainWindow = state.mainWindow;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });

    // Keep double-click if you want
    mb.tray.on("double-click", () => {
      const mainWindow = state.mainWindow;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  });
};
