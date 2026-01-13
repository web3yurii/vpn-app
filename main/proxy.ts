// src/main/proxy.ts
import {
    AnonRunningError,
    BootstrapProgressEvent,
    Control,
    Process,
    Socks,
    StateManager,
    VPNManager,
    VPNManagerEvent,
} from "@anyone-protocol/anyone-client";
import { VPNTarget } from "@anyone-protocol/anyone-client/out/models";
import { stopProxy as stopPrivoxy } from "./utils/proxy";
import { setProxySettings } from "./systemProxy";
import { ProxyRuleConfig, RelayData, state } from "./state";
import { getFingerPrintData, showNotification } from "./utils";
import { ipcMain } from "electron";
import Store from "electron-store";

const store = new Store();

export interface ProxyRule {
    id: string;
    title: string;
    destinations: string[];
    hops: number;
    entryCountries: string[];
    exitCountries: string[];
}

export async function startAnyoneProxy() {
    if (state.anon) {
        console.log("Anyone proxy is already running.");
        return;
    }

    try {
        const fingerprintData = await getFingerPrintData();
        state.fingerprintData = fingerprintData;
    } catch (error) {
        console.error("Error getting fingerprint to geo list:", error);
        state.mainWindow?.webContents.send(
            "proxy-error",
            `\nWhoops! Something went wrong:\n ${error.message}`
        );
        state?.tray?.window?.webContents.send(
            "proxy-error",
            `\nWhoops! Something went wrong:\n ${error.message}`
        );
        return;
    }

    try {
        const exePath = state.exePath;
        const termsFilePath = state.termsFilePath;

        console.log("connecting with anyone port: ", state.anonPort);

        try {
            if (termsFilePath) {
                state.anon = new Process({
                    displayLog: false,
                    binaryPath: exePath,
                    autoTermsAgreement: true,
                    termsFilePath: termsFilePath,
                });
            } else {
                state.anon = new Process({
                    displayLog: false,
                    binaryPath: exePath,
                    autoTermsAgreement: true,
                });
            }
        } catch (error) {
            console.error("Error creating Anyone process:", error);
            state.mainWindow?.webContents.send(
                "proxy-error",
                `Error creating Anyone process: ${error.message}`
            );
        }

        state.anon.on('bootstrap-progress', (event: BootstrapProgressEvent) => {
            state.mainWindow?.webContents.send("proxy-progress", event.percentage, event.status);
            state.tray?.window?.webContents.send("proxy-progress", event.percentage, event.status);
        });

        // Listen to bootstrap complete event
        state.anon.on('bootstrap-complete', (event) => {
            state.mainWindow?.webContents.send("proxy-complete", { complete: true });
            state.tray?.window?.webContents.send("proxy-complete", { complete: true });
        });

        state.anonPort = state.anon.getSOCKSPort();
        state.anonControlPort = state.anon.getControlPort();

        state.anonSocksClient = new Socks(state.anon);

        try {
            await state.anon.start();
        } catch (error) {
            if (error instanceof AnonRunningError) {
                console.log("Anyone process is already running");
                state.mainWindow?.webContents.send(
                    "anon-running-error",
                    `Anyone process is already running`
                );
            } else {
                console.error("Error starting Anyone process:", error);
                if (error.message.includes("60 seconds")) {
                    return;
                }
                state.mainWindow?.webContents.send(
                    "proxy-error",
                    `Error starting Anyone process: ${error.message}`
                );
            }
            return;
        }
        console.log("Anyone proxy started.");

        setProxySettings(true, state.proxyPort);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Create Control client and authenticate
        try {
            state.anonControlClient = new Control();
        } catch (error: any) {
            console.error("Error creating Anyone control client:", error);
            state.mainWindow?.webContents.send(
                "proxy-error",
                `Error creating control client: ${error.message}`
            );
            state.tray?.window?.webContents.send(
                "proxy-error",
                `Error creating control client: ${error.message}`
            );
        }
        await state.anonControlClient.authenticate();

        // Initialize StateManager (for relay caching, VPNManager handles events)
        console.log("Initializing StateManager...");
        state.stateManager = new StateManager(state.anonControlClient, {
            autoSubscribeEvents: false,  // VPNManager will handle events
            cacheRelays: true,
            populateCountries: true,
        });
        await state.stateManager.initialize();
        console.log(`StateManager ready: ${state.stateManager.getRelays().length} relays loaded`);

        // Get relay data for UI
        const relayData = await getRelayData();
        state.relayIp = relayData?.ip;
        state.relayData = relayData;
        state.numberOfRelays = relayData?.numberOfRelays || 0;

        // Convert proxy rules to VPN targets
        const vpnTargets = convertProxyRulesToVPNTargets();

        if (vpnTargets.length > 0) {
            // Initialize VPNManager for routing
            console.log("Initializing VPNManager...");
            state.vpnManager = new VPNManager(state.stateManager, {
                targets: vpnTargets,
                healthMonitorInterval: 10000, // 10 seconds
            });

            // Set up VPNManager event listeners
            setupVPNManagerListeners();

            await state.vpnManager.initialize();

            // Resume background resolution after VPNManager init
            state.stateManager.resumeBackgroundResolution();

            console.log("VPNManager initialized with targets:", vpnTargets.map(t => t.address));
        } else {
            console.log("No proxy rules configured, running without VPNManager");
            // Resume background resolution even without VPNManager
            state.stateManager.resumeBackgroundResolution();
        }

        state.mainWindow?.webContents.send("proxy-started");
        state.tray?.window?.webContents.send("proxy-started");
        state.isProxyRunning = true;
        showNotification(
            "Proxy Started",
            "Your system is now using the Anyone proxy."
        );
        ipcMain.emit("proxy:stateChanged", true, true);
    } catch (error: any) {
        console.log("Error starting Anyone proxy:", error);
        state.mainWindow?.webContents.send(
            "proxy-error",
            `Error starting proxy: ${error.message}`
        );
        state.tray?.window?.webContents.send(
            "proxy-error",
            `Error starting proxy: ${error.message}`
        );
        state.anon = null;
        state.anonSocksClient = null;
        state.stateManager = null;
        state.vpnManager = null;
        await stopPrivoxy();
        setProxySettings(false, state.proxyPort);
        showNotification("Proxy Error", `Failed to start proxy: ${error.message}`);
    }
}

function convertProxyRulesToVPNTargets(): VPNTarget[] {
    const proxyRules = store.get('proxyRules', []) as ProxyRule[];

    // Also store in state for backwards compatibility
    state.proxyRuleConfig = {
        routings: proxyRules.flatMap(rule =>
            rule.destinations.map(destination => ({
                targetAddress: destination,
                hops: rule.hops,
                entryCountries: rule.entryCountries,
                exitCountries: rule.exitCountries,
            }))
        )
    } as ProxyRuleConfig;

    // Convert to VPNTarget format
    // Group destinations by exit countries to create VPN targets
    const vpnTargets: VPNTarget[] = [];

    for (const rule of proxyRules) {
        for (const destination of rule.destinations) {
            vpnTargets.push({
                address: destination,
                exitCountries: rule.exitCountries.map(c => c.toLowerCase()),
                minCircuits: 1,
                maxCircuits: 3,
            });
        }
    }

    return vpnTargets;
}

function setupVPNManagerListeners() {
    if (!state.vpnManager) return;

    state.vpnManager.on(VPNManagerEvent.TARGET_READY, (info) => {
        console.log(`[VPN] Target ${info.target} ready: circuit ${info.circuitId} (${info.country})`);
        state.mainWindow?.webContents.send("circuit-ready", {
            target: info.target,
            circuitId: info.circuitId,
            country: info.country,
            timestamp: new Date().toISOString()
        });
        state.tray?.window?.webContents.send("circuit-ready", {
            target: info.target,
            circuitId: info.circuitId,
            country: info.country,
            timestamp: new Date().toISOString()
        });
    });

    state.vpnManager.on(VPNManagerEvent.TARGET_DEGRADED, (info) => {
        console.log(`[VPN] Target ${info.target} DEGRADED: ${info.currentCircuits}/${info.minCircuits} circuits`);
        state.mainWindow?.webContents.send("circuit-failure", {
            target: info.target,
            currentCircuits: info.currentCircuits,
            minCircuits: info.minCircuits,
            timestamp: new Date().toISOString()
        });
        state.tray?.window?.webContents.send("circuit-failure", {
            target: info.target,
            currentCircuits: info.currentCircuits,
            minCircuits: info.minCircuits,
            timestamp: new Date().toISOString()
        });
    });

    state.vpnManager.on(VPNManagerEvent.STREAM_ROUTED, (info) => {
        console.log(`[VPN] Stream ${info.streamId} routed to circuit ${info.circuitId} for ${info.target}`);
    });
}

export async function getRelayData(): Promise<RelayData | null> {
    try {
        // Use StateManager's relay cache if available
        if (state.stateManager && state.stateManager.isReady()) {
            const relays = state.stateManager.getRelays();
            const guards = state.stateManager.getGuards();

            if (guards.length > 0) {
                const relay = guards[0];
                const locationData = state.fingerprintData.get(relay.fingerprint);
                return {
                    ip: relay.ip,
                    fingerprint: relay.fingerprint,
                    nickname: relay.nickname,
                    coordinates: locationData?.coordinates,
                    hexId: locationData?.hexID,
                    numberOfRelays: relays.length,
                } as RelayData;
            }
        }

        // Fallback to direct control client query
        if (!state.anonControlClient) {
            return null;
        }

        const circuits = await state.anonControlClient.circuitStatus();

        for (const circuit of circuits) {
            const nodes = circuit.relays;
            if (nodes && nodes.length > 0) {
                const fingerprint = nodes[0].fingerprint;
                try {
                    const relayInfo = await state.anonControlClient.getRelayInfo(fingerprint);
                    const locationData = state.fingerprintData.get(fingerprint);
                    return {
                        ip: relayInfo.ip,
                        fingerprint,
                        nickname: relayInfo.nickname,
                        coordinates: locationData?.coordinates,
                        hexId: locationData?.hexID,
                        numberOfRelays: circuits.length,
                    } as RelayData;
                } catch (relayError) {
                    console.log('Error getting relay info:', relayError);
                    continue;
                }
            }
        }
    } catch (error: any) {
        console.log("Failed to get relay data:", error);
        state.mainWindow?.webContents.send(
            "proxy-error",
            `Error getting relay data: ${error?.message || 'Unknown error'}`
        );
        state.tray?.window?.webContents.send(
            "proxy-error",
            `Error getting relay data: ${error?.message || 'Unknown error'}`
        );
    }

    return null;
}

export async function stopAnyoneProxy() {
    if (!state.anon) {
        console.log("Anyone proxy is not running.");
        return;
    }

    setProxySettings(false, state.proxyPort);

    // Stop background resolution first
    if (state.stateManager) {
        state.stateManager.stopBackgroundResolution();
    }

    // Shutdown VPNManager
    if (state.vpnManager) {
        try {
            await state.vpnManager.shutdown();
        } catch (e) {
            console.error("Error shutting down VPNManager:", e);
        }
        state.vpnManager = null;
    }

    // Shutdown StateManager
    if (state.stateManager) {
        try {
            await state.stateManager.shutdown();
        } catch (e) {
            console.error("Error shutting down StateManager:", e);
        }
        state.stateManager = null;
    }

    // Close control connection
    if (state.anonControlClient) {
        try {
            state.anonControlClient.end();
        } catch (e) {
            console.error("Error closing control client:", e);
        }
        state.anonControlClient = null;
    }

    try {
        await state.anon.stop();
        console.log("Anyone proxy stopped.");

        await stopPrivoxy();

        state.isProxyRunning = false;
        state.relayIp = "-";
        state.relayData = null;

        state.mainWindow?.webContents.send("proxy-stopped");
        state.tray?.window?.webContents.send("proxy-stopped");
        ipcMain.emit("proxy:stateChanged", false, false);
    } catch (error: any) {
        console.log("Error stopping Anyone proxy:", error);
        state.mainWindow?.webContents.send(
            "proxy-error",
            `Error stopping proxy: ${error.message}`
        );
        state.tray?.window?.webContents.send(
            "proxy-error",
            `Error stopping proxy: ${error.message}`
        );
    } finally {
        state.anon = null;
        state.anonSocksClient = null;
    }
}
