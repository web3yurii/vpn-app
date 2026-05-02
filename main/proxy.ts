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
import { EventType, StreamEvent, VPNTarget } from "@anyone-protocol/anyone-client/out/models";
import { stopProxy as stopPrivoxy } from "./utils/proxy";
import { setProxySettings } from "./systemProxy";
import { ProxyRuleConfig, RelayData, state } from "./state";
import { getFingerPrintData, showNotification, checkIP } from "./utils";
import { ipcMain, app } from "electron";
import Store from "electron-store";
import net from "net";
import fs from "fs";
import path from "path";

const store = new Store();

export interface ProxyRule {
    id: string;
    title: string;
    destinations: string[];
    hops: number;
    entryCountries: string[];
    exitCountries: string[];
    enabled?: boolean;
}

/**
 * Maps normalized apex domain → VPN target config (without address).
 * Only populated when the global "matchSubdomains" setting is enabled.
 */
const baseDomainTargetMap = new Map<string, Omit<VPNTarget, "address">>();

/** Populate the base-domain map from active VPN targets (only when global setting is on). */
function populateBaseDomainMap(targets: VPNTarget[]): void {
    baseDomainTargetMap.clear();
    if (!store.get("matchSubdomains", false)) return;
    for (const t of targets) {
        const apex = t.address.replace(/^www\./, "");
        if (!baseDomainTargetMap.has(apex)) {
            baseDomainTargetMap.set(apex, {
                exitCountries: t.exitCountries,
                minCircuits: t.minCircuits,
                maxCircuits: t.maxCircuits,
                hopCount: t.hopCount,
            });
        }
    }
}

/**
 * Return the base domain in `baseDomainTargetMap` that `hostname` is a subdomain of,
 * or `null` if there is no match.
 * Examples:
 *   "google.com"      → "google.com"  (exact)
 *   "docs.google.com" → "google.com"  (subdomain)
 *   "evil.com"        → null
 */
function findMatchingBaseDomain(hostname: string): string | null {
    if (baseDomainTargetMap.has(hostname)) return hostname;
    const parts = hostname.split(".");
    // Walk from left to right: try docs.google.com, then google.com
    for (let i = 1; i < parts.length - 1; i++) {
        const candidate = parts.slice(i).join(".");
        if (baseDomainTargetMap.has(candidate)) return candidate;
    }
    return null;
}

/** Try the preferred port; if in use, let the OS pick a free one. */
async function findFreePort(preferred: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(preferred, "127.0.0.1", () => {
            server.close(() => resolve(preferred));
        });
        server.on("error", () => {
            // preferred port is busy — ask OS for any free port
            const fallback = net.createServer();
            fallback.listen(0, "127.0.0.1", () => {
                const port = (fallback.address() as net.AddressInfo).port;
                fallback.close(() => resolve(port));
            });
            fallback.on("error", () => resolve(preferred)); // last resort
        });
    });
}

/** Copy the latest consensus files to a backup dir so future fresh installs can seed from them. */
function updateConsensusBackup() {
    const userData = app.getPath("userData");
    const dataDir  = path.join(userData, "anon-data");
    const backupDir = path.join(userData, "anon-backup");
    try {
        fs.mkdirSync(backupDir, { recursive: true });
        for (const file of ["cached-microdesc-consensus", "cached-certs"]) {
            const src = path.join(dataDir, file);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(backupDir, file));
            }
        }
    } catch { /* non-critical */ }
}

/**
 * Write a persistent anon config file that points to a fixed DataDirectory.
 * This lets anon reuse cached descriptors across restarts for faster bootstrap.
 */
function createPersistentConfig(socksPort: number, controlPort: number, exePath: string): string {
    const userData = app.getPath("userData");
    const persistentDataDir = path.join(userData, "anon-data");
    const configFilePath = path.join(userData, "anonrc");

    // Derive GeoIP paths from the binary location
    const binaryDir = path.dirname(exePath);
    const geoipFile = path.join(binaryDir, "geoip");
    const geoipV6File = path.join(binaryDir, "geoip6");

    // Ensure the persistent data directory exists
    fs.mkdirSync(persistentDataDir, { recursive: true });

    // Seed consensus files from the runtime backup if the data dir is fresh.
    // The backup is written after every successful proxy start so it stays current.
    const consensusFiles = ["cached-microdesc-consensus", "cached-certs"];
    const backupDir = path.join(userData, "anon-backup");
    for (const file of consensusFiles) {
        const dest = path.join(persistentDataDir, file);
        const src  = path.join(backupDir, file);
        if (!fs.existsSync(dest) && fs.existsSync(src)) {
            try { fs.copyFileSync(src, dest); } catch { /* ignore */ }
        }
    }

    // Ensure terms-agreement exists in both the DataDirectory and the binary's
    // own directory — the anon binary checks its own dir first.
    const termsLocations = [
        path.join(persistentDataDir, "terms-agreement"),
        path.join(binaryDir, "terms-agreement"),
    ];
    const termsSource = state.termsFilePath;
    for (const termsTarget of termsLocations) {
        if (!fs.existsSync(termsTarget)) {
            if (termsSource && fs.existsSync(termsSource)) {
                try { fs.copyFileSync(termsSource, termsTarget); } catch { /* ignore */ }
            } else {
                // autoTermsAgreement may have written it to cwd; copy from there
                const cwdTerms = path.join(process.cwd(), "terms-agreement");
                if (fs.existsSync(cwdTerms)) {
                    try { fs.copyFileSync(cwdTerms, termsTarget); } catch { /* ignore */ }
                } else {
                    // Last resort: create marker file with required content
                    try { fs.writeFileSync(termsTarget, "agreed"); } catch { /* ignore */ }
                }
            }
        }
    }

    const configLines = [
        `DataDirectory ${persistentDataDir}`,
        `SOCKSPort ${socksPort}`,
        `ORPort 0`,
        `ControlPort ${controlPort}`,
        ...(fs.existsSync(geoipFile) ? [`GeoIPFile ${geoipFile}`] : []),
        ...(fs.existsSync(geoipV6File) ? [`GeoIPv6File ${geoipV6File}`] : []),
    ];

    // Always overwrite — ports change between runs
    fs.writeFileSync(configFilePath, configLines.join("\n") + "\n");

    return configFilePath;
}

export async function startAnyoneProxy() {
    if (state.anon || state.isProxyStarting || state.isProxyStopping) {
        console.log("Anyone proxy is already running or starting.");
        return;
    }
    state.isProxyStarting = true;

    try {
        const exePath = state.exePath;

        // ── Resolve ports ──
        // With dynamic port OFF (default): use the configured ports as-is so
        // tools like Firefox that have a hardcoded port keep working.
        // With dynamic port ON: probe for a free port to avoid bind conflicts.
        const dynamicPort = store.get("dynamicPort", true) as boolean;
        const socksPort = dynamicPort ? await findFreePort(state.anonPort) : state.anonPort;
        const controlPort = dynamicPort ? await findFreePort(state.anonControlPort) : state.anonControlPort;
        console.log(`Using SOCKS port: ${socksPort}, Control port: ${controlPort} (dynamic: ${dynamicPort})`);

        // ── Start fingerprint fetch in parallel (non-blocking) ──
        // Proxy start continues regardless of whether this succeeds.
        // Globe coordinates will simply be unavailable if it fails.
        const fingerprintPromise = getFingerPrintData()
            .then((data) => {
                state.fingerprintData = data ?? new Map();
            })
            .catch(() => {
                // Will retry via proxy after startup; globe coords unavailable until then
            });

        // ── Create persistent config for cached descriptor reuse ──
        const configFilePath = createPersistentConfig(socksPort, controlPort, exePath);

        console.log("connecting with anyone port: ", socksPort);

        try {
            state.anon = new Process({
                displayLog: false,
                binaryPath: exePath,
                socksPort,
                controlPort,
                configFile: configFilePath,
            });
        } catch (error) {
            console.error("Error creating Anyone process:", error);
            state.mainWindow?.webContents.send(
                "proxy-error",
                `Error creating Anyone process: ${error.message}`
            );
        }

        state.anon.on("bootstrap-progress", (event: BootstrapProgressEvent) => {
            state.mainWindow?.webContents.send("proxy-progress", event.percentage, event.status);
            state.tray?.window?.webContents.send("proxy-progress", event.percentage, event.status);
        });

        // Listen to bootstrap complete event
        state.anon.on("bootstrap-complete", (event) => {
            state.mainWindow?.webContents.send("proxy-complete", { complete: true });
            state.tray?.window?.webContents.send("proxy-complete", { complete: true });
        });

        state.anonPort = state.anon.getSOCKSPort();
        state.anonControlPort = state.anon.getControlPort();
        // Keep proxyPort in sync — system proxy must point to the actual SOCKS port
        state.proxyPort = state.anonPort;
        state.mainWindow?.webContents.send("proxy-port-changed", state.proxyPort);
        state.tray?.window?.webContents.send("proxy-port-changed", state.proxyPort);

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

        // Create Control client and authenticate using the actual dynamic port
        try {
            state.anonControlClient = new Control('127.0.0.1', state.anonControlPort);
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
            return;
        }

        // Retry authenticate — the control port may not be ready immediately after start
        {
            const maxAttempts = 5;
            const delays = [1500, 2000, 3000, 4000, 5000];
            let lastError: any;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
                try {
                    await state.anonControlClient.authenticate();
                    lastError = null;
                    break;
                } catch (error: any) {
                    lastError = error;
                    console.warn(`Control authenticate attempt ${attempt + 1} failed: ${error.message}`);
                }
            }
            if (lastError) {
                throw lastError;
            }
        }

        // Apply global exit country if configured
        const globalExitCountry = store.get("globalExitCountry", null) as string | null;
        if (globalExitCountry) {
            try {
                await state.anonControlClient.setConf("ExitNodes", `{${globalExitCountry}}`);
                await state.anonControlClient.setConf("StrictNodes", "1");
            } catch (e: any) {
                if (e?.message?.includes("circuit-status")) {
                    console.warn("SETCONF interleaved with circuit-status event, command likely succeeded");
                } else {
                    throw e;
                }
            }
        }

        // Initialize StateManager (for relay caching, VPNManager handles events)
        console.log("Initializing StateManager...");
        state.stateManager = new StateManager(state.anonControlClient, {
            autoSubscribeEvents: false,  // VPNManager will handle events
            cacheRelays: true,
            populateCountries: true,
        });
        await state.stateManager.initialize();
        console.log(`StateManager ready: ${state.stateManager.getRelays().length} relays loaded`);

        const availableCountries = state.stateManager.getAvailableCountries();
        if (availableCountries.length > 0) {
            store.set("cachedAvailableCountries", availableCountries);
        }

        // Give the parallel fingerprint fetch 500 ms to finish (it'll already be done
        // if the network is fast). If still pending, proceed and let the proxy retry
        // handle it in the background — fingerprint data is non-critical.
        await Promise.race([fingerprintPromise, new Promise<void>(r => setTimeout(r, 500))]);

        // Retry via proxy for any case where direct fetch didn't succeed
        if (!state.fingerprintData || state.fingerprintData.size === 0) {
            getFingerPrintData(state.anonSocksClient)
                .then((data) => {
                    if (data && data.size > 0) {
                        state.fingerprintData = data;
                        console.log(`Fingerprint data loaded: ${data.size} relays`);
                    }
                })
                .catch(() => {
                    console.log("Relay coordinates unavailable — globe will show relays without positions");
                });
        }

        // Get relay data for UI
        const relayData = await getRelayData();
        state.relayIp = relayData?.ip;
        state.relayData = relayData;
        state.numberOfRelays = relayData?.numberOfRelays || 0;

        // Convert proxy rules to VPN targets
        const vpnTargets = convertProxyRulesToVPNTargets();
        // Populate base-domain map so subdomain expansion can happen at runtime
        populateBaseDomainMap(vpnTargets);

        if (vpnTargets.length > 0) {
            // Initialize VPNManager for routing
            console.log("Initializing VPNManager...");
            state.vpnManager = new VPNManager(state.stateManager, {
                targets: vpnTargets,
                healthMonitorInterval: 10000, // 10 seconds
            });

            // Set up VPNManager event listeners
            setupVPNManagerListeners();

            // Register subdomain STREAM interceptor BEFORE vpnManager.initialize() so
            // our handler fires first and can attach subdomain streams to existing
            // parent-rule circuits before VPNManager falls back to default routing.
            await setupSubdomainStreamInterceptor();

            await state.vpnManager.initialize();

            // Resume background resolution after VPNManager init
            state.stateManager.resumeBackgroundResolution();

            console.log("VPNManager initialized with targets:", vpnTargets.map(t => t.address));
        } else {
            console.log("No proxy rules configured, running without VPNManager");
            // Resume background resolution even without VPNManager
            state.stateManager.resumeBackgroundResolution();
        }

        // Listen to all STREAM events to update circuit flags for any traffic.
        // Note: "AttachStream failed (551)" warnings from the SDK's event-dispatcher
        // are a known transient race condition in VPNManager — the stream succeeds on
        // retry. No action needed; they do not affect functionality.
        setupStreamCircuitListener();

        state.mainWindow?.webContents.send("proxy-started");
        state.tray?.window?.webContents.send("proxy-started");
        state.isProxyRunning = true;
        state.isProxyStarting = false;
        showNotification(
            "Proxy Started",
            "Your system is now using the Anyone proxy."
        );
        ipcMain.emit("proxy:stateChanged", true, true);

        // Fetch the proxy IP here in the main process so we don't race against
        // circuit availability from the renderer side. Push the result via
        // proxy-ip-changed once the first successful check arrives.
        checkIP(true).then((ip) => {
            if (ip) {
                state.proxyIp = ip;
                state.mainWindow?.webContents.send("proxy-ip-changed", ip);
                state.tray?.window?.webContents.send("proxy-ip-changed", ip);
            }
        }).catch(() => {});
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
        state.isProxyStarting = false;
        await stopPrivoxy();
        setProxySettings(false, state.proxyPort);
        showNotification("Proxy Error", `Failed to start proxy: ${error.message}`);
    } finally {
        state.isProxyStarting = false;
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

    const vpnTargets: VPNTarget[] = [];
    for (const rule of proxyRules) {
        if (rule.enabled === false) continue;
        for (const destination of rule.destinations) {
            vpnTargets.push({
                address: destination,
                exitCountries: rule.exitCountries.map(c => c.toLowerCase()),
                minCircuits: 1,
                maxCircuits: 3,
                hopCount: rule.hops as 2 | 3,
            });
        }
    }

    return vpnTargets;
}

/**
 * Register a STREAM event handler BEFORE VPNManager.initialize() so our handler
 * fires first in the listener queue (handlers are called in registration order).
 *
 * When a STREAM NEW event arrives for a subdomain (e.g. docs.google.com) that
 * matches a rule destination (google.com), we attach it directly to one of the
 * parent target's already-built circuits instead of letting VPNManager fall back
 * to default (circuit 0) routing. This means subdomain traffic is correctly
 * routed even on the very first visit.
 *
 * After attaching, VPNManager's own handler fires and gets a 551 "already
 * attached" response — the same transient race condition that already exists and
 * is documented as harmless.
 */
async function setupSubdomainStreamInterceptor() {
    if (!state.anonControlClient || !state.vpnManager) return;

    const subdomainHandler = async (event: StreamEvent) => {
        if (event.status !== "NEW" || !event.streamId || baseDomainTargetMap.size === 0) return;

        const target = (event.target ?? "").split(":")[0];
        if (!target) return;

        // If the target is already a known VPN target let VPNManager handle it normally
        const internalTargets = (state.vpnManager as any).targets as VPNTarget[];
        if (internalTargets.some((t) => t.address === target)) return;

        // Check for parent-domain match
        const matchedBase = findMatchingBaseDomain(target);
        if (!matchedBase) return;

        // Find built circuits for the parent rule destination
        const circuits: Map<number, any> = (state.vpnManager as any).circuits;
        const parentCircuits = Array.from(circuits.values()).filter(
            (c) => c.status === "BUILT" && c.target === matchedBase
        );

        if (parentCircuits.length === 0) {
            // No circuits built yet (e.g. very early in startup) — VPNManager's
            // default routing will handle this stream; future visits will succeed.
            return;
        }

        // Pick the least-loaded circuit
        const circuit = parentCircuits.reduce((a, b) =>
            (a.streamCount ?? 0) <= (b.streamCount ?? 0) ? a : b
        );

        try {
            const attached = await state.anonControlClient.attachStream(event.streamId, circuit.id);
            if (attached) {
                console.log(
                    `[subdomain] ${target} → reused circuit ${circuit.id} (rule: ${matchedBase})`
                );
                // Register subdomain as an explicit target so VPNManager tracks it
                // natively from now on (avoids per-stream overhead on future visits)
                if (!internalTargets.some((t) => t.address === target)) {
                    const config = baseDomainTargetMap.get(matchedBase)!;
                    internalTargets.push({ address: target, ...config });
                }
            }
        } catch {
            // 551 = already attached by VPNManager, or stream closed — both are harmless
        }
    };

    await state.anonControlClient.addEventListener(subdomainHandler, EventType.STREAM);
}

interface HopDetail {
    fingerprint: string;
    nickname: string;
    ip: string;
    country: string;
    bandwidth: number;
    flags: string[];
}

interface CircuitData {
    countries: string[];
    coordinates: Array<{ latitude: number; longitude: number } | null>;
    hopDetails: HopDetail[];
}
const circuitPathMap = new Map<number, CircuitData>(); // circuitId → hop data
let lastSentCircuitId: number | null = null;

function setupVPNManagerListeners() {
    if (!state.vpnManager) return;
    circuitPathMap.clear();
    lastSentCircuitId = null;

    state.vpnManager.on(VPNManagerEvent.TARGET_READY, (info) => {
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
}

async function setupStreamCircuitListener() {
    if (!state.anonControlClient) return;

    const resolvingCircuits = new Set<number>(); // prevent duplicate async resolutions

    const streamHandler = async (event: StreamEvent) => {
        if (event.status !== 'SUCCEEDED' || !event.circId) return;
        const circId = event.circId;
        if (circId === lastSentCircuitId) return;

        // Resolve countries for this circuit if not already cached
        if (!circuitPathMap.has(circId) && !resolvingCircuits.has(circId)) {
            resolvingCircuits.add(circId);
            try {
                const circuitStatus = await state.anonControlClient.getCircuit(circId);
                if (circuitStatus?.relays?.length) {
                    const hopCountries: string[] = [];
                    const hopCoordinates: Array<{ latitude: number; longitude: number } | null> = [];
                    const hopDetails: HopDetail[] = [];
                    for (const relay of circuitStatus.relays) {
                        try {
                            const relayInfo = await state.anonControlClient.getRelayInfo(relay.fingerprint);
                            const country = relayInfo?.ip
                                ? await state.anonControlClient.getCountry(relayInfo.ip)
                                : null;
                            const cc = country?.toUpperCase() ?? '??';
                            hopCountries.push(cc);
                            hopDetails.push({
                                fingerprint: relay.fingerprint,
                                nickname: relayInfo?.nickname ?? relay.nickname ?? '?',
                                ip: relayInfo?.ip ?? '?',
                                country: cc,
                                bandwidth: relayInfo?.bandwidth ?? 0,
                                flags: (relayInfo?.flags ?? []).map(String),
                            });
                        } catch {
                            hopCountries.push('??');
                            hopDetails.push({
                                fingerprint: relay.fingerprint,
                                nickname: relay.nickname ?? '?',
                                ip: '?',
                                country: '??',
                                bandwidth: 0,
                                flags: [],
                            });
                        }
                        const coordData = state.fingerprintData?.get(relay.fingerprint);
                        hopCoordinates.push(coordData?.coordinates ?? null);
                    }
                    circuitPathMap.set(circId, { countries: hopCountries, coordinates: hopCoordinates, hopDetails });
                }
            } catch {
                // circuit may have closed already
            } finally {
                resolvingCircuits.delete(circId);
            }
        }

        const circuitData = circuitPathMap.get(circId);
        if (!circuitData?.countries.length) return;
        if (circId === lastSentCircuitId) return; // recheck after await

        lastSentCircuitId = circId;
        const payload = {
            circuitId: circId,
            target: event.target ?? '',
            hopCountries: circuitData.countries,
            hopCoordinates: circuitData.coordinates,
            hopDetails: circuitData.hopDetails,
        };
        state.mainWindow?.webContents.send("circuit-path-updated", payload);
        state.tray?.window?.webContents.send("circuit-path-updated", payload);
    };

    await state.anonControlClient.addEventListener(streamHandler, EventType.STREAM);
}

export async function getRelayData(): Promise<RelayData | null> {
    try {
        // Use StateManager's relay cache if available
        if (state.stateManager && state.stateManager.isReady()) {
            const relays = state.stateManager.getRelays();
            const guards = state.stateManager.getGuards();

            if (guards.length > 0) {
                const relay = guards[0];
                const locationData = state.fingerprintData?.get(relay.fingerprint);
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
                    const locationData = state.fingerprintData?.get(fingerprint);
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
    state.isProxyStopping = true;

    baseDomainTargetMap.clear();
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
        // Snapshot the freshest consensus before the process exits
        updateConsensusBackup();
        try {
            await state.anon.stop();
        } catch (stopErr) {
            // stop() failed — force-kill as fallback
            try { await Process.killAnonProcess(); } catch (_) {}
        }
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
        state.isProxyStarting = false;  // clear if stop was called during a start
        state.isProxyStopping = false;
    }
}
