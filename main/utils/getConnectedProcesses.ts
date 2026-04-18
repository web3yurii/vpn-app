// src/utils/getConnectedProcesses.ts
import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import extractIcon from "file-icon-extractor";
// import { getProcessIconPathUnix } from "./getProcessIconPathUnix";
import {
  getProcessIconPathUnix,
  getProcessIconUnix,
} from "./getProcessIconPathUnix";
import { normalizeProcessNameCapital } from "./processIconMap";

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  processName: string;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
}

export interface GroupedProcessInfo {
  processName: string;
  friendlyName: string;
  iconPath: string | null;
  count: number;
  pids: number[];
  remoteAddresses: string[];
  remotePorts: number[];
}

export async function getGroupedConnectedProcesses(
  port: number
): Promise<GroupedProcessInfo[]> {
  const processes = await getConnectedProcesses(port);

  const grouped: { [key: string]: GroupedProcessInfo } = {};

  for (const proc of processes) {
    const normalizedName = normalizeProcessNameCapital(proc.processName);
    if (normalizedName === "Electron") {
      continue;
    }

    if (!grouped[normalizedName]) {
      grouped[normalizedName] = {
        processName: normalizedName,
        friendlyName: getFriendlyAppName(normalizedName),
        iconPath: null, // To be filled later
        count: 1,
        pids: [proc.pid],
        remoteAddresses: [proc.remoteAddress],
        remotePorts: [proc.remotePort],
      };
    } else {
      grouped[normalizedName].count += 1;
      grouped[normalizedName].pids.push(proc.pid);
      grouped[normalizedName].remoteAddresses.push(proc.remoteAddress);
      grouped[normalizedName].remotePorts.push(proc.remotePort);
    }
  }

  // Fetch icons for each grouped process
  const groupedList: GroupedProcessInfo[] = [];

  for (const key in grouped) {
    const group = grouped[key];
    // Only try to get icon if we don't have one already
    if (!group.iconPath) {
      const osPlatform = platform();

      if (osPlatform === "win32") {
        const iconPath = await getProcessIconPathWindows(
          group.pids[0].toString()
        );
        group.iconPath = iconPath;
      } else if (osPlatform === "darwin") {
        const iconPath = await getProcessIconUnix(group.pids[0].toString());
        group.iconPath = iconPath;
      } else if (osPlatform === "linux") {
        const iconPath = await getProcessIconPathUnix(group.pids[0].toString());
        group.iconPath = iconPath;
        group.processName = normalizeProcessNameCapital(group.processName);
      }
    }
    groupedList.push(group);
  }
  return groupedList;
}

export async function getConnectedProcesses(
  port: number
): Promise<ProcessInfo[]> {
  const osPlatform = platform();

  if (osPlatform === "win32") {
    return getWindowsProcesses(port);
  } else if (osPlatform === "darwin" || osPlatform === "linux") {
    return getUnixProcesses(port);
  } else {
    throw new Error(`Unsupported platform: ${osPlatform}`);
  }
}

// Windows-specific implementation
async function getWindowsProcesses(port: number): Promise<ProcessInfo[]> {
  const { stdout } = await execAsync("netstat -ano -p tcp");
  const lines = stdout.split("\n").slice(4); // Skip header lines
  const processes: ProcessInfo[] = [];

  for (const line of lines) {
    const columns = line.trim().split(/\s+/);
    if (columns.length >= 5) {
      const [protocol, localAddress, foreignAddress, state, pid] = columns;
      if (
        protocol.toLowerCase() === "tcp" &&
        state.toLowerCase() === "established"
      ) {
        const foreignPort = parseInt(foreignAddress.split(":").pop() || "", 10);
        if (foreignPort === port) {
          // Correct: Checking if foreign port matches
          const processName = await getProcessNameWindows(pid);
          const localPort = parseInt(localAddress.split(":").pop() || "", 10);
          const remotePort = foreignPort;
          const remoteAddress = foreignAddress
            .split(":")
            .slice(0, -1)
            .join(":");
          const localAddressClean = localAddress
            .split(":")
            .slice(0, -1)
            .join(":");

          processes.push({
            pid: parseInt(pid, 10),
            processName,
            localAddress: localAddressClean,
            localPort,
            remoteAddress,
            remotePort,
          });
        }
      }
    }
  }

  return processes;
}

async function getProcessNameWindows(pid: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tasklist /FI "PID eq ${pid}" /FO CSV /NH`
    );
    const [processName] = stdout.split(",");
    return processName.replace(/"/g, "");
  } catch {
    return "Unknown";
  }
}

// Helper function to map process names to friendly application names
function getFriendlyAppName(processName: string): string {
  const mapping: { [key: string]: string } = {
    "chrome.exe": "Chrome",
    "firefox.exe": "Firefox",
    "electron.exe": "Electron App",
    "telegram.exe": "Telegram",
    "whatsapp.exe": "WhatsApp",
    "slack.exe": "Slack",
    "zoom.exe": "Zoom",
    "code.exe": "VS Code",
    code: "VS Code",
    Code: "VS Code",
    // Add more mappings as needed
  };
  return mapping[processName.toLowerCase()] || processName;
}
// Function to get the executable path of a process on Windows
async function getExecutablePathWindows(pid: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `wmic process where processid=${pid} get executablepath`
    );
    const pathLine = stdout.split("\n")[1].trim();
    return pathLine || null;
  } catch {
    return null;
  }
}

// Function to extract the icon from the executable and save it as a PNG
async function getProcessIconPathWindows(pid: string): Promise<string | null> {
  const exePath = await getExecutablePathWindows(pid);
  if (!exePath) {
    console.error(`Executable path not found for PID: ${pid}`);
    return null;
  }

  const processName = path.basename(exePath, ".exe"); // Get the process name from the executable path
  const destinationFolder = os.tmpdir();
  const iconFileName = `icon_${processName}.png`; // Use process name instead of PID for file name
  const iconPngPath = path.join(destinationFolder, iconFileName);

  // Check if the icon is already in the cache
  if (iconCache[processName]) {
    if (fs.existsSync(iconCache[processName] as string)) {
      // console.log(
      //   `Using cached icon for process ${processName}: ${iconCache[processName]}`
      // );
      return iconCache[processName]; // Return the cached path
    }
  }

  try {
    // console.log(
    //   `Extracting icon for process ${processName} (PID: ${pid}) from ${exePath}`
    // );
    // Use the extract method as per documentation
    await extractIcon.extract(exePath, destinationFolder, "png");

    // The extract function saves the icon with the same base name as the executable
    const extractedIconName = `${processName}.png`;
    const extractedIconPath = path.join(destinationFolder, extractedIconName);

    if (fs.existsSync(extractedIconPath)) {
      // Rename or move the extracted icon to a unique name based on process name
      if (extractedIconPath !== iconPngPath) {
        fs.renameSync(extractedIconPath, iconPngPath); // Ensure consistent naming
      }

      // console.log(
      //   `Icon extracted and saved as PNG for process ${processName}: ${iconPngPath}`
      // );

      // Cache the result
      iconCache[processName] = iconPngPath;
      saveIconCache(); // Save the cache to disk
      return iconPngPath;
    } else {
      console.error(
        `Icon extraction failed for process ${processName}. Icon not found at: ${extractedIconPath}`
      );
      return null;
    }
  } catch (error: any) {
    console.error(`Error extracting icon from ${exePath}:`, error);
    return null;
  }
}

// Unix-specific implementation
async function getUnixProcesses(port: number): Promise<ProcessInfo[]> {
  let stdout: string;
  try {
    ({ stdout } = await execAsync(`lsof -i tcp:${port} -nP`));
  } catch {
    // lsof exits with code 1 when no matching connections exist — not a real error
    return [];
  }
  const lines = stdout.split("\n").slice(1); // Skip header line
  const processes: ProcessInfo[] = [];

  for (const line of lines) {
    const columns = line.trim().split(/\s+/);

    // Check if we have at least 9 columns to proceed
    if (columns.length >= 9) {
      const [command, pid, , , , , , , name] = columns;

      // Check if the `name` contains the '->' separator
      if (name.includes("->")) {
        const [localAddress, remoteAddress] = name.split("->");

        // Safely extract ports, default to 0 if parsing fails
        const localPort = parseInt(localAddress.split(":").pop() || "0", 10);
        const remotePort = parseInt(remoteAddress.split(":").pop() || "0", 10);

        // Remove ports from addresses for cleaner formatting
        const localAddressClean = localAddress
          .split(":")
          .slice(0, -1)
          .join(":");
        const remoteAddressClean = remoteAddress
          .split(":")
          .slice(0, -1)
          .join(":");

        processes.push({
          pid: parseInt(pid, 10),
          processName: command,
          localAddress: localAddressClean,
          localPort,
          remoteAddress: remoteAddressClean,
          remotePort,
        });
      } else {
        // console.warn(`Skipping line due to unexpected format: ${line}`);
      }
    } else {
    }
  }

  return processes;
}

const iconCacheFilePath = path.join(os.tmpdir(), "iconCache.json");
let iconCache: { [key: string]: string | null } = {};

// Load cache on startup
if (fs.existsSync(iconCacheFilePath)) {
  const cacheData = fs.readFileSync(iconCacheFilePath, "utf-8");
  try {
    iconCache = JSON.parse(cacheData);
  } catch {
    console.error("Failed to parse icon cache. Starting with an empty cache.");
    iconCache = {};
  }
}

// Function to save cache
export function saveIconCache() {
  try {
    fs.writeFileSync(iconCacheFilePath, JSON.stringify(iconCache), "utf-8");
  } catch (error) {
    console.error("Failed to save icon cache:", error);
  }
}
