export const processIconMap: { [key: string]: string } = {
  code: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/visualstudiocode.svg",
  visual: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/visualstudiocode.svg",
  "google chrome": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/googlechrome.svg",
  google: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/googlechrome.svg",
  brave: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/brave.svg",
  slack: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/slack.svg",
  safari: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/safari.svg",
  firefox: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/firefox.svg",
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
