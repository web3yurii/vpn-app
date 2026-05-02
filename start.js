// start.js
const { spawn, execSync } = require("child_process");

process.title = "AnyoneVpn";

function clearProxySync() {
  try {
    let interfaces = [];
    try {
      const out = execSync(
        'networksetup -listnetworkserviceorder | grep -B1 "Hardware Port: \\(Wi-Fi\\|.*LAN\\)" | grep "^([0-9*])" | sed \'s/^([0-9*]*) //\''
      ).toString().trim();
      interfaces = out.split("\n").filter((i) => i.trim().length > 0);
    } catch (_) {}
    if (interfaces.length === 0) interfaces = ["Wi-Fi"];
    for (const iface of interfaces) {
      try {
        execSync(`networksetup -setsocksfirewallproxystate "${iface.trim()}" off`);
        process.stderr.write(`[proxy] cleared SOCKS proxy on ${iface}\n`);
      } catch (e) {
        process.stderr.write(`[proxy] failed to clear ${iface}: ${e.message}\n`);
      }
    }
  } catch (_) {}
}

const nextronProcess = spawn("npx", ["nextron"], {
  stdio: "inherit",
  shell: false,
});

nextronProcess.on("exit", (code) => process.exit(code ?? 0));

// SIGINT (Ctrl+C) reaches this plain Node process reliably — clear the proxy
// here before nextron kills Electron via SIGTERM (which bypasses Node handlers).
process.on("SIGINT", () => {
  clearProxySync();
  nextronProcess.kill("SIGINT");
});
