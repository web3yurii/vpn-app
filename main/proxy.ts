// src/main/proxy.ts
import {AnonRunningError, BootstrapProgressEvent, Control, Process, Socks} from "@anyone-protocol/anyone-client";
import {stopProxy as stopPrivoxy,} from "./utils/proxy";
import {setProxySettings} from "./systemProxy";
import {ProxyRuleConfig, RelayData, state} from "./state";
import {checkIP, getFingerPrintData, showNotification} from "./utils";
import {ipcMain} from "electron";
import Store from "electron-store";
import {EventType, ExtendCircuitOptions, Flag, StreamEvent} from "@anyone-protocol/anyone-client/out/models";

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
    // const anonPort = await state.anonPort;
    // const anonControlPort = state.anonControlPort;
    // state.anonPort = anonPort;
    // state.anonControlPort = anonControlPort;

    console.log("connecting with anyone port: ", state.anonPort);

    try {
      if (termsFilePath) {
        state.anon = new Process({
          displayLog: true,
          // socksPort: state.anonPort,
          // controlPort: state.anonControlPort,
          binaryPath: exePath,
          autoTermsAgreement: true,
          termsFilePath: termsFilePath,
        });
      } else {
        state.anon = new Process({
          displayLog: true,
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
      console.log(`Bootstrap progress: ${event.percentage}% - ${event.status}`);
      state.mainWindow?.webContents.send("proxy-progress", event.percentage, event.status);
      state.tray?.window?.webContents.send("proxy-progress", event.percentage, event.status);
    });
    
    // Listen to bootstrap complete event
    state.anon.on('bootstrap-complete', (event) => {
        console.log('Bootstrap complete');
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

    // do not start privoxy, use anon directly
    // state.proxyPort = await startPrivoxy(state.anonPort);

    setProxySettings(true, state.proxyPort);

    await new Promise((resolve) => setTimeout(resolve, 1500));
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

    const socksIp = await checkIP(true);
    state.proxyIp = socksIp;
    ipcMain.emit("proxy:stateChanged", socksIp);
    const relayData = await getRelayData();
    state.relayIp = relayData.ip;
    state.relayData = relayData;
    state.numberOfRelays = relayData.numberOfRelays;

    await createRoutingMap(); // THIS IS WHERE THE ROUTUING MAP IS CREATED

    // Start circuit monitoring
    await startCircuitMonitoring();

    state.mainWindow?.webContents.send("proxy-started");
    state.tray?.window?.webContents.send("proxy-started");
    state.isProxyRunning = true;
    showNotification(
      "Proxy Started",
      "Your system is now using the Anyone proxy."
    );
    // ipcmain send even proxy:stateChanged
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
    await stopPrivoxy();
    setProxySettings(false, state.proxyPort);
    showNotification("Proxy Error", `Failed to start proxy: ${error.message}`);
  }
}

export async function getRelayData() {
  let circuitRetries = 3;
  let relayInfoRetries = 2;
  let lastError = null;

  while (circuitRetries > 0) {
    try {
      const circuits = await getCircuitStatusWithRetry();
      console.log('Got circuit status');
      
      // If we get here, we successfully got the circuit status
      for (const circuit of circuits) {
        const nodes = circuit.relays;
        if (nodes && nodes.length > 0) {
          const fingerprint = nodes[0].fingerprint;
          let relayInfoAttempts = relayInfoRetries;
          
          while (relayInfoAttempts > 0) {
            try {
              const relayInfo = await state.anonControlClient.getRelayInfo(fingerprint);
              const nickname = relayInfo.nickname;
              const ip = relayInfo.ip;
              const locationData = state.fingerprintData.get(fingerprint);
              return {
                ip,
                fingerprint,
                nickname,
                coordinates: locationData?.coordinates,
                hexId: locationData?.hexID,
                numberOfRelays: circuits.length,
              } as RelayData;
            } catch (relayError) {
              console.log(`Error getting relay info (attempt ${relayInfoRetries - relayInfoAttempts + 1}/${relayInfoRetries}):`, relayError);
              lastError = relayError;
              relayInfoAttempts--;
              if (relayInfoAttempts === 0) break;
              // await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
        }
      }
      
      // If we get here, no circuits had relays or we couldn't get relay info
      circuitRetries--;
      if (circuitRetries === 0) break;
      console.log(`No valid circuits found, retrying... (${circuitRetries} attempts left)`);
      // await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log(`Error getting circuit status (attempt ${4-circuitRetries}/3):`, error);
      lastError = error;
      circuitRetries--;
      if (circuitRetries === 0) break;
      console.log(`Retrying in 2 seconds... (${circuitRetries} attempts left)`);
      // await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("Failed to get relay data after multiple attempts:", lastError);
  state.mainWindow?.webContents.send(
    "proxy-error",
    `Error getting relay data: ${lastError?.message || 'Unknown error'}`
  );
  state.tray?.window?.webContents.send(
    "proxy-error",
    `Error getting relay data: ${lastError?.message || 'Unknown error'}`
  );
}

export async function stopAnyoneProxy() {
  if (!state.anon) {
    console.log("Anyone proxy is not running.");
    return;
  }
  
  // Stop circuit monitoring
  if (state.circuitMonitorInterval) {
    clearInterval(state.circuitMonitorInterval);
    state.circuitMonitorInterval = null;
  }
  
  setProxySettings(false, state.proxyPort);
  if (state.anonControlClient) {
    state.anonControlClient.end();
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

// Circuit failure detection and handling
async function handleCircuitFailure(failedCircuitId: string, target: string) {
  console.log(`Handling circuit failure for circuit ${failedCircuitId} targeting ${target}`);
  
  try {
    // Remove the failed circuit from routing map if it exists
    const targetAddress = target.split(':')[0];
    if (state.routingMap[targetAddress] === parseInt(failedCircuitId)) {
      
      delete state.routingMap[targetAddress];
      console.log(`Removed failed circuit ${failedCircuitId} from routing map for ${targetAddress}`);
      
      // Notify UI about circuit failure
      state.mainWindow?.webContents.send("circuit-failure", {
        circuitId: failedCircuitId,
        target: targetAddress,
        timestamp: new Date().toISOString()
      });
      state.tray?.window?.webContents.send("circuit-failure", {
        circuitId: failedCircuitId,
        target: targetAddress,
        timestamp: new Date().toISOString()
      });
      
      // Attempt to recreate the circuit
      await recreateCircuitForTarget(targetAddress);
    }
  } catch (error) {
    console.error(`Error handling circuit failure for ${failedCircuitId}:`, error);
  }
}

// Recreate circuit for a specific target
async function recreateCircuitForTarget(targetAddress: string) {
  try {
    const route = state.proxyRuleConfig.routings.find(r => r.targetAddress === targetAddress);
    if (!route) {
      console.error(`No route configuration found for ${targetAddress}`);
      return;
    }
    
    console.log(`Recreating circuit for ${targetAddress}`);
    
    // Get fresh relay lists
    const relays = await state.anonControlClient.getRelays();
    let exits = state.anonControlClient.filterRelaysByFlags(relays, Flag.Exit);
    let guards = state.anonControlClient.filterRelaysByFlags(relays, Flag.Guard);
    let middleRelays = state.anonControlClient.filterRelaysByFlags(relays, Flag.Stable)
      .filter(relay => 
        relay.flags.includes(Flag.Stable) &&
        relay.flags.includes(Flag.Running) &&
        !relay.flags.includes(Flag.Exit) &&
        !relay.flags.includes(Flag.Guard)
      );
    
    // Filter out bad exits
    exits = exits.filter((exit) => !exit.flags.includes(Flag.BadExit));
    
    // Get exit node based on country requirements
    const exitsByCountry = exits.filter((exit) => 
      route.exitCountries.some((country) => exit.country?.toLowerCase() === country.toLowerCase())
    );
    
    if (exitsByCountry.length === 0) {
      console.error(`No exits found for countries: ${route.exitCountries.join(', ')}`);
      return;
    }
    
    const exit = exitsByCountry[Math.floor(Math.random() * exitsByCountry.length)];
    const guard = guards[Math.floor(Math.random() * guards.length)];
    
    // Create new path
    const path = [guard.fingerprint];
    for (let i = 0; i < route.hops - 2; i++) {
      const availableMiddleRelays = middleRelays.filter(relay => 
        !path.includes(relay.fingerprint)
      );
      
      if (availableMiddleRelays.length === 0) {
        console.error('No available middle relays for path');
        return;
      }
      
      const middle = availableMiddleRelays[Math.floor(Math.random() * availableMiddleRelays.length)];
      path.push(middle.fingerprint);
    }
    path.push(exit.fingerprint);
    
    const options: ExtendCircuitOptions = {
      circuitId: 0,
      serverSpecs: path,
      purpose: "general",
      awaitBuild: true
    };
    
    const newCircuitId = await state.anonControlClient.extendCircuit(options);
    state.routingMap[targetAddress] = newCircuitId;
    
    console.log(`Successfully recreated circuit ${newCircuitId} for ${targetAddress}`);
    
    // Notify UI about circuit recreation
    state.mainWindow?.webContents.send("circuit-recreated", {
      oldCircuitId: targetAddress,
      newCircuitId: newCircuitId,
      target: targetAddress,
      timestamp: new Date().toISOString()
    });
    state.tray?.window?.webContents.send("circuit-recreated", {
      oldCircuitId: targetAddress,
      newCircuitId: newCircuitId,
      target: targetAddress,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Failed to recreate circuit for ${targetAddress}:`, error);
  }
}

// Robust circuit status checking with retries
async function getCircuitStatusWithRetry(maxRetries: number = 3): Promise<any[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const circuits = await state.anonControlClient.circuitStatus();
      return circuits;
    } catch (error) {
      console.log(`Circuit status attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (error.message.includes('Invalid response format')) {
        if (attempt === maxRetries) {
          console.log('Max retries reached for circuit status, returning empty array');
          return [];
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      if (error.message.includes('Connection refused') || error.message.includes('ECONNREFUSED')) {
        console.log('Control connection lost, attempting to reconnect...');
        try {
          await state.anonControlClient.authenticate();
          console.log('Control connection re-established, retrying circuit status');
          // Try again after reconnection
          const circuits = await state.anonControlClient.circuitStatus();
          return circuits;
        } catch (reconnectError) {
          console.error('Failed to reconnect:', reconnectError);
          if (attempt === maxRetries) {
            throw new Error('Failed to reconnect control client after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  return [];
}

// Periodic circuit health monitoring
async function startCircuitMonitoring() {
  const monitorInterval = setInterval(async () => {
    if (!state.isProxyRunning || !state.anonControlClient) {
      clearInterval(monitorInterval);
      return;
    }
    
    console.log('Checking circuit status');
    try {
      const circuits = await getCircuitStatusWithRetry();
      const failedCircuits = circuits.filter(circuit => 
        circuit.state === 'FAILED' || circuit.state === 'CLOSED'
      );
      if (failedCircuits.length > 0) {
        console.log(`Found ${failedCircuits.length} failed/closed circuits:`, failedCircuits.map(c => c.circuitId));
        
        for (const failedCircuit of failedCircuits) {
          // Find which target this circuit was serving
          const targetAddress = Object.keys(state.routingMap).find(
            target => state.routingMap[target] === failedCircuit.circuitId
          );
          
          if (targetAddress) {
            console.log(`Circuit ${failedCircuit.circuitId} failed for target ${targetAddress}`);
            await handleCircuitFailure(failedCircuit.circuitId.toString(), targetAddress);
          }

        }
      }
    } catch (error) {
      console.error('Error in circuit monitoring:', error);
      
      // Handle specific error types
      if (error.message.includes('Invalid response format')) {
        console.log('Control connection may be unstable, will retry on next interval');
        // Don't throw - just log and continue monitoring
        return;
      }
      
      if (error.message.includes('Connection refused') || error.message.includes('ECONNREFUSED')) {
        console.log('Control connection lost, attempting to reconnect...');
        try {
          // Try to re-authenticate the control connection
          await state.anonControlClient.authenticate();
          console.log('Control connection re-established');
        } catch (reconnectError) {
          console.error('Failed to reconnect control client:', reconnectError);
          // If we can't reconnect, the proxy might need to be restarted
          state.mainWindow?.webContents.send("proxy-error", "Control connection lost. Please restart the proxy.");
          state.tray?.window?.webContents.send("proxy-error", "Control connection lost. Please restart the proxy.");
        }
        return;
      }
      
      // For other errors, log but don't stop monitoring
      console.log('Circuit monitoring will continue despite error');
    }
  }, 5000); // Check every 5 seconds
  
  // Store the interval ID for cleanup
  state.circuitMonitorInterval = monitorInterval;
}

async function createRoutingMap() {
  const relays = await state.anonControlClient.getRelays();
  let exits = state.anonControlClient.filterRelaysByFlags(relays, Flag.Exit);
  let guards = state.anonControlClient.filterRelaysByFlags(relays, Flag.Guard);
  let middleRelays = state.anonControlClient.filterRelaysByFlags(relays, Flag.Stable)
    .filter(relay => 
      relay.flags.includes(Flag.Stable) &&
      relay.flags.includes(Flag.Running) &&
      !relay.flags.includes(Flag.Exit) && // not Exit allowed for middle
      !relay.flags.includes(Flag.Guard) // not Guard allowed for middle
    );
  
  // import the routing map from the store
  const proxyRules = store.get('proxyRules', []) as ProxyRule[];
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
  const routingMap: Record<string, number> = {};

  // Filter out bad exits
  exits = exits.filter((exit) => !exit.flags.includes(Flag.BadExit));
  console.log('Available exits:', exits.length);

  // populate country field
  let retries = 3;
  let success = false;
  while (retries > 0 && !success) {
    try {
      await state.anonControlClient.populateCountries(exits);
      success = true;
    } catch (error) {
      console.log(`GeoIP data not loaded, retrying... (${retries} attempts left)`);
      retries--;
      if (retries === 0) {
        throw new Error('Failed to load GeoIP data after multiple attempts');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('Available guards:', guards.length);
  console.log('Available middle relays:', middleRelays.length);

  for (const route of state.proxyRuleConfig.routings) {
    try {
      // Get exit node based on country requirements
      const exitsByCountry = exits.filter((exit) => 
        route.exitCountries.some((country) => exit.country?.toLowerCase() === country.toLowerCase())
      );
      
      if (exitsByCountry.length === 0) {
        console.error(`No exits found for countries: ${route.exitCountries.join(', ')}`);
        continue;
      }

      const exit = exitsByCountry[Math.floor(Math.random() * exitsByCountry.length)];
      
      // // Get entry guard
      // const guardsByCountry = guards.filter((guard) => 
      //   !route.entryCountries.some((country) => guard.country?.toLowerCase() === country.toLowerCase())
      // );
      
      // if (guardsByCountry.length === 0) {
      //   console.error(`No guards found excluding countries: ${route.entryCountries.join(', ')}`);
      //   continue;
      // }

      // const guard = guardsByCountry[Math.floor(Math.random() * guardsByCountry.length)];
      const guard = guards[Math.floor(Math.random() * guards.length)];

      // Create path with middle relays based on hop count
      const path = [guard.fingerprint];
      
      // Add middle relays if needed (hops - 2 because we already have guard and exit)
      for (let i = 0; i < route.hops - 2; i++) {
        const availableMiddleRelays = middleRelays.filter(relay => 
          !path.includes(relay.fingerprint)
        );
        
        if (availableMiddleRelays.length === 0) {
          console.error('No available middle relays for path');
          continue;
        }
        
        const middle = availableMiddleRelays[Math.floor(Math.random() * availableMiddleRelays.length)];
        path.push(middle.fingerprint);
      }
      
      path.push(exit.fingerprint);

      console.log(`Created path for ${route.targetAddress} with ${route.hops} hops:`, path);

      const options: ExtendCircuitOptions = {
        circuitId: 0,
        serverSpecs: path,
        purpose: "general",
        awaitBuild: true
      };

      const circuitId = await state.anonControlClient.extendCircuit(options);
      const circ = await state.anonControlClient.getCircuit(circuitId);
      routingMap[route.targetAddress] = circuitId;
      console.log('Circuit created:', circuitId);
    } catch (error) {
      console.error(`Failed to create circuit for ${route.targetAddress}:`, error);
    }
  }

  state.routingMap = routingMap;
  console.log('Final routing map:', routingMap);

  await state.anonControlClient.disableStreamAttachment();

  const eventListener = async (event: StreamEvent) => {
    try {
      // console.log('Stream event:', event);
      
      if (event.status === 'NEW') {
        const targetAddress = event.target.split(':')[0];
        // console.log('event', event);
        
        // Check if the target address matches any key in the routing map using includes
        let circuitId: number | undefined;
        for (const [key, value] of Object.entries(state.routingMap)) {
          if (targetAddress.includes(key) || key.includes(targetAddress)) {
            circuitId = value;
            break;
          }
        }

        if (circuitId && (event.circId === '0' || event.circId === undefined)) {
          console.log('Attaching stream to circuit in routing map:', circuitId);
          try {
            await state.anonControlClient.attachStream(event.streamId, circuitId);
          } catch (error) {
            console.error(`Failed to attach stream ${event.streamId} to circuit ${circuitId}:`, error);
            // Continue processing other streams even if this one fails
          }
        } else {
          try {
            await state.anonControlClient.attachStream(event.streamId, 0);
          } catch (error) {
            console.error(`Failed to attach stream ${event.streamId} to circuit 0:`, error);
            // Continue processing other streams even if this one fails
          }
        }
      }
    } catch (error) {
      console.error('Error in stream event listener:', error);
      // Don't let individual stream errors crash the entire listener
    }
  };

  try {
    await state.anonControlClient.addEventListener(
      eventListener, 
      EventType.STREAM
    );
  } catch (error) {
    console.error('Failed to register stream event listener:', error);
    // Continue without stream routing if listener registration fails
  }
}

