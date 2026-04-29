// src/main/constants.ts
import serve from "electron-serve";
import path from "path";
import { app } from "electron";

export const isProd = app.isPackaged;

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

// Determine the executable path based on the environment
export const exePath = (() => {
  let exePath;
  const platform = process.platform;
  const arch = process.arch;

  if (app.isPackaged) {
    if (platform === "win32") {
      exePath = path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "win32",
        "x64",
        "anon.exe"
      );
    } else if (platform === "darwin") {
      exePath = path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "darwin",
        arch,
        "anon"
      );
    } else if (platform === "linux") {
      exePath = path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "linux",
        arch,
        "anon"
      );
    }
  } else {
    if (platform === "win32") {
      exePath = path.join(
        path.dirname(__dirname),
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "win32",
        "x64",
        "anon.exe"
      );
    } else if (platform === "darwin") {
      exePath = path.join(
        path.dirname(__dirname),
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "darwin",
        arch,
        "anon"
      );
    } else if (platform === "linux") {
      exePath = path.join(
        path.dirname(__dirname),
        "node_modules",
        "@anyone-protocol",
        "anyone-client",
        "bin",
        "linux",
        arch,
        "anon"
      );
    }
  }

  return exePath;
})();

export const termsFilePath = (() => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "terms-agreement");
  } else {
    // Development: file lives at the project root
    return path.join(path.dirname(__dirname), "terms-agreement");
  }
})();
