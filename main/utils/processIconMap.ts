export const processIconMap: { [key: string]: string } = {
  code: "/icons/vscode.svg",
  visual: "/icons/vscode.svg",
  "google chrome": "/icons/chrome.svg",
  google: "/icons/chrome.svg",
  brave: "/icons/brave.png",
  slack: "/icons/slack.svg",
  terminal: "/icons/terminal.svg",
  finder: "/icons/finder.png",
  safari: "/icons/safari.svg",
  firefox: "/icons/firefox.svg",
  "System Preferences": "/icons/system-preferences.svg",
};

/**
 * Normalizes the process name by converting to lowercase and removing unwanted suffixes.
 * @param processName The original process name.
 * @returns The normalized process name.
 */
export function normalizeProcessName(processName: string): string {
  // Convert to lowercase
  let normalized = processName.toLowerCase();
  normalized = normalized.replace(".exe", "");
  normalized = normalized.replace(".app", "");
  normalized = normalized.replace("\x20h", "");
  normalized = normalized.replace("\x20", "");
  normalized = normalized.replace("x20h", "");
  normalized = normalized.replace("x20", "");
  // Remove URL encoding or escape sequences (e.g., /x20h)
  // This regex removes any '/x' followed by hexadecimal characters
  normalized = normalized.replace(/\/x[0-9a-f]{2}/g, "");

  // Remove any remaining non-alphanumeric characters except spaces
  normalized = normalized.replace(/[^a-z0-9 ]/g, "");

  // Trim whitespace
  normalized = normalized.trim();

  return normalized;
}

export function normalizeProcessNameCapital(processName: string): string {
  processName = normalizeProcessName(processName);
  return processName.charAt(0).toUpperCase() + processName.slice(1);
}
