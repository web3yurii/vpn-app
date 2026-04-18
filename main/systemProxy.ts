// src/main/systemProxy.ts
import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function getNetworkInterfaces(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('networksetup -listnetworkserviceorder | grep -B1 "Hardware Port: \\(Wi-Fi\\|.*LAN\\)" | grep "^([0-9*])" | sed \'s/^([0-9*]*) //\'');
    return stdout.trim().split('\n').filter(networkInterface => networkInterface.trim().length > 0);
  } catch (error) {
    console.error('Error getting network interfaces:', error);
    return ['Wi-Fi']; // fallback to Wi-Fi if command fails
  }
}

// Synchronous proxy clear — used in SIGINT/SIGTERM handlers where async ops
// cannot be awaited because the event loop is already tearing down.
export function clearProxySync() {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      let interfaces: string[] = [];
      try {
        const stdout = execSync(
          'networksetup -listnetworkserviceorder | grep -B1 "Hardware Port: \\(Wi-Fi\\|.*LAN\\)" | grep "^([0-9*])" | sed \'s/^([0-9*]*) //\''
        ).toString().trim();
        interfaces = stdout.split('\n').filter(i => i.trim().length > 0);
      } catch (_) {}
      if (interfaces.length === 0) interfaces = ['Wi-Fi'];
      for (const iface of interfaces) {
        try { execSync(`networksetup -setsocksfirewallproxystate "${iface.trim()}" off`); } catch (_) {}
      }
    } else if (platform === "win32") {
      const reg = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"`;
      try { execSync(`reg add ${reg} /v ProxyEnable /t REG_DWORD /d 0 /f`); } catch (_) {}
    } else if (platform === "linux") {
      try { execSync("gsettings set org.gnome.system.proxy mode 'none'"); } catch (_) {}
    }
  } catch (_) {}
}

export async function setProxySettings(enable: boolean, proxyPort: number) {
  const platform = process.platform;
  const proxyAddress = `127.0.0.1:${proxyPort}`;

  if (platform === "win32") {
    const registryPath = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"`;

    if (enable) {
      exec(`reg add ${registryPath} /v ProxyEnable /t REG_DWORD /d 1 /f`);
      exec(
        `reg add ${registryPath} /v ProxyServer /t REG_SZ /d "socks=${proxyAddress}" /f`
      );
      console.log("Proxy has been enabled.");
    } else {
      exec(`reg add ${registryPath} /v ProxyEnable /t REG_DWORD /d 0 /f`);
      exec(`reg delete ${registryPath} /v ProxyServer /f`);
      console.log("Proxy has been disabled.");
    }
  } else if (platform === "darwin") {
    try {
      const networkInterfaces = await getNetworkInterfaces();
      console.log(`Found network interfaces: ${networkInterfaces.join(', ')}`);

      for (const networkInterface of networkInterfaces) {
        if (enable) {
          await execAsync(`networksetup -setsocksfirewallproxy "${networkInterface}" 127.0.0.1 ${proxyPort}`);
          await execAsync(`networksetup -setsocksfirewallproxystate "${networkInterface}" on`);
          console.log(`Proxy has been enabled for ${networkInterface}.`);
        } else {
          await execAsync(`networksetup -setsocksfirewallproxystate "${networkInterface}" off`);
          console.log(`Proxy has been disabled for ${networkInterface}.`);
        }
      }
    } catch (error) {
      console.error('Error setting proxy for network interfaces:', error);
    }
  } else if (platform === "linux") {
    if (enable) {
      exec("gsettings set org.gnome.system.proxy mode 'manual'");
      exec(`gsettings set org.gnome.system.proxy.socks host '127.0.0.1'`);
      exec(`gsettings set org.gnome.system.proxy.socks port ${proxyPort}`);
    } else {
      exec("gsettings set org.gnome.system.proxy mode 'auto'");
      exec("gsettings reset org.gnome.system.proxy.socks host");
      exec("gsettings reset org.gnome.system.proxy.socks port");
    }

    console.log("Proxy settings adjustment not fully implemented for Linux.");
  }
}
