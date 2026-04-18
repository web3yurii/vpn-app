import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import util from "util";
import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { getAppIconByPid } from "@lwtlab/node-mac-app-icon";
import axios from "axios";
import { processIconMap, normalizeProcessName } from "./processIconMap";
import svg2img from "svg2img";
const execAsync = util.promisify(exec);
let iconCache: { [key: string]: string } = {}; // Cache for icons
let failedIconCache: { [key: string]: boolean } = {}; // Cache for failed attempts

export async function getProcessIconUnix(pid: string): Promise<string | null> {
  try {
    const exePath = await getExecutablePathUnix(pid);
    
    if (!exePath || !exePath.includes("Applications")) {
      return null;
    }

    const processName = path.basename(exePath).replace("\x20H", "");
    const destinationFolder = os.tmpdir();
    const iconFileName = `icon_${processName}.png`;
    const iconPngPath = path.join(destinationFolder, iconFileName);

    // Check cache first - if we have a cached icon, return it immediately
    if (iconCache[processName]) {
      const cachedPath = iconCache[processName];
      if (fs.existsSync(cachedPath)) {
        return cachedPath;
      }
    }

    // If we've tried to get an icon for this process before and failed, don't try again
    if (failedIconCache[processName]) {
      return null;
    }

    // Try to get the icon as a buffer from getAppIconByPid.
    // The process may have exited between the lsof listing and this call — that's a
    // normal race condition, not an error worth logging.
    const buffer = await getAppIconByPid(parseInt(pid, 10), {
      size: 128,
    }).catch(() => null);

    if (buffer) {
      const icon = nativeImage.createFromBuffer(buffer);
      if (!icon.isEmpty()) {
        fs.writeFileSync(iconPngPath, icon.toPNG());
        iconCache[processName] = iconPngPath;
        saveIconCache();
        return iconPngPath;
      }
    }

    // If buffer retrieval or icon creation failed, try extracting from `.icns`
    try {
      const icnsPath = path.join(exePath, "../../../Resources/AppIcon.icns");
      if (fs.existsSync(icnsPath)) {
        const iconFromIcns = nativeImage.createFromPath(icnsPath);
        fs.writeFileSync(iconPngPath, iconFromIcns.toPNG());
      }

      if (fs.existsSync(iconPngPath)) {
        iconCache[processName] = iconPngPath;
        saveIconCache();
        return iconPngPath;
      } else {
        // Try web fetch only if we haven't tried before
        if (!failedIconCache[`${processName}_web_tried`]) {
          const webIcon = await fetchIconFromWeb(processName);
          if (webIcon) {
            return webIcon;
          }
          // Mark that we've tried web fetch for this process
          failedIconCache[`${processName}_web_tried`] = true;
        }
        // Mark that we've failed to get an icon for this process
        failedIconCache[processName] = true;
        saveIconCache();
        return null;
      }
    } catch (error: any) {
      console.error(`Error extracting icon for ${processName}:`, error);
      // Mark that we've failed to get an icon for this process
      failedIconCache[processName] = true;
      saveIconCache();
      return null;
    }
  } catch (error) {
    console.error(`Failed to get icon for PID ${pid}: ${error}`);
    return null;
  }
}

async function getExecutablePathUnix(pid: string): Promise<string | null> {
  // Check if we're on macOS
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execAsync(
        `lsof -p ${pid} | grep txt | awk '{print $9}'`
      );
      return stdout.trim();
    } catch (error: any) {
      console.error(
        `Error getting executable path for PID ${pid} on macOS:`,
        error.message
      );
      return null;
    }
  }

  // For Linux, try /proc approach
  if (process.platform === "linux") {
    try {
      const { stdout } = await execAsync(`readlink /proc/${pid}/exe`);
      return stdout.trim();
    } catch (error: any) {
      console.warn(`Executable path not found or inaccessible for PID: ${pid}`);
      return null;
    }
  }

  // Unsupported platform
  console.error("Unsupported platform for getting executable path.");
  return null;
}

async function getProcessIconPathUnix(pid: string): Promise<string | null> {
  const exePath = await getExecutablePathUnix(pid);
  if (!exePath) {
    return null;
  }

  const processName = path.basename(exePath).replace("\x20H", "");
  const destinationFolder = os.tmpdir();
  const iconFileName = `icon_${processName}.png`;
  const iconPngPath = path.join(destinationFolder, iconFileName);

  // Check if the icon is already in the cache
  if (iconCache[processName]) {
    if (fs.existsSync(iconCache[processName] as string)) {
      return iconCache[processName];
    }
  }

  try {
    // macOS: Use `sips` to convert the icon from .icns to .png
    if (process.platform === "darwin" && exePath.includes(".app")) {
      const icnsPath = path.join(exePath, "../../../Resources/AppIcon.icns");
      // console.log("icnsPath", icnsPath);
      if (fs.existsSync(icnsPath)) {
        const icon = nativeImage.createFromPath(icnsPath);
        fs.writeFileSync(iconPngPath, icon.toPNG());
      }
    }

    // Linux: Try to find the icon in common icon directories or from .desktop files
    if (process.platform === "linux") {
      const iconPath = await getLinuxAppIconPath(exePath);
      if (iconPath) {
        fs.copyFileSync(iconPath, iconPngPath); // Copy the icon to the temp directory
      }
    }

    if (fs.existsSync(iconPngPath)) {
      iconCache[processName] = iconPngPath;
      saveIconCache(); // Save the cache to disk
      return iconPngPath;
    } else {
      console.warn(
        `Local icon not found for process ${processName}. Attempting to fetch from web.`
      );
      return await fetchIconFromWeb(processName);
    }
  } catch (error: any) {
    console.error(`Error extracting icon for ${processName}:`, error);
    return null;
  }
}

// Helper function for Linux to find app icon path from .desktop files or icon directories
async function getLinuxAppIconPath(exePath: string): Promise<string | null> {
  const appName = path.basename(exePath);
  const iconSearchPaths = [
    `/usr/share/icons/hicolor/48x48/apps/${appName}.png`,
    `/usr/share/pixmaps/${appName}.png`,
    `/usr/share/applications/${appName}.desktop`,
    `${os.homedir()}/.local/share/applications/${appName}.desktop`,
  ];

  for (const iconPath of iconSearchPaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  // If a .desktop file is found, parse it for the Icon entry
  const desktopFilePath = iconSearchPaths.find(
    (path) => path.endsWith(".desktop") && fs.existsSync(path)
  );
  if (desktopFilePath) {
    const desktopFileContent = fs.readFileSync(desktopFilePath, "utf-8");
    const iconMatch = desktopFileContent.match(/^Icon=(.*)$/m);
    if (iconMatch && iconMatch[1]) {
      const iconName = iconMatch[1].trim();
      // Try to find the icon by name in common icon paths
      return `/usr/share/icons/hicolor/48x48/apps/${iconName}.png`;
    }
  }

  return null;
}

// Function to save icon cache to disk (optional)
function saveIconCache() {
  const cachePath = path.join(app.getPath("userData"), "iconCache.json");
  fs.writeFileSync(cachePath, JSON.stringify({
    icons: iconCache,
    failed: failedIconCache
  }));

  // Icon cache saved to disk
}

// Load cache on startup
const cachePath = path.join(app.getPath("userData"), "iconCache.json");
if (fs.existsSync(cachePath)) {
  try {
    const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    iconCache = cacheData.icons || {};
    failedIconCache = cacheData.failed || {};
  } catch (error) {
    console.error("Failed to parse icon cache. Starting with empty caches.");
    iconCache = {};
    failedIconCache = {};
  }
}

async function fetchIconFromWeb(processName: string): Promise<string | null> {
  try {
    let iconUrl: string | null = null;

    if (iconCache[processName] && fs.existsSync(iconCache[processName])) {
      console.log(
        `Icon for ${processName} is already cached. Skipping download.`
      );
      return iconCache[processName];
    }
    const normalizedProcessName = normalizeProcessName(processName);

    // Check if the process name is in the predefined map
    if (processIconMap[normalizedProcessName]) {
      console.log(`Found icon URL in map for process: ${processName}`);
      iconUrl = processIconMap[normalizedProcessName];
    }
    // else {
    //   iconUrl = `https://api.iconify.design/simple-icons:${processName.toLowerCase()}.svg`;
    // }

    if (!iconUrl) {
      console.error(`No icon URL found for process: ${processName}`);
      return null;
    }

    // Download the icon
    const response = await axios.get(iconUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data, "binary");

    // Convert SVG to PNG if necessary
    let pngBuffer: Buffer;
    if (iconUrl.endsWith(".svg")) {
      pngBuffer = await new Promise((resolve, reject) => {
        svg2img(iconUrl, (error, buffer) => {
          if (error) return reject(error);
          resolve(buffer);
        });
      });
    } else {
      pngBuffer = buffer;
    }

    // Save the icon to the temp directory
    const destinationFolder = os.tmpdir();
    const iconFileName = `icon_${processName}_web.png`;
    const iconPngPath = path.join(destinationFolder, iconFileName);
    fs.writeFileSync(iconPngPath, pngBuffer);

    // Update the cache
    iconCache[processName] = iconPngPath;
    saveIconCache();

    return iconPngPath;
  } catch (error) {
    console.error(
      `Failed to fetch icon from web for process ${processName}:`,
      error
    );
    return null;
  }
}

export { getProcessIconPathUnix };
