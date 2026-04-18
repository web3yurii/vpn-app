// src/context/AppProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { FingerPrintData } from "../../main/utils";
import { RelayData } from "../../main/state";
import { ProxyRule } from "../../main/proxy";
interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  countryCode: string;
}

interface AppContextType {
  realIP: string | null;
  proxyIP: string | null;
  realLocation: LocationData | null;
  proxyLocation: LocationData | null;
  relayLocation: LocationData | null;
  circuitHopCountries: string[];
  circuitHopCoordinates: Array<{ latitude: number; longitude: number } | null>;
  circuitHopDetails: Array<{ fingerprint: string; nickname: string; ip: string; country: string; bandwidth: number; flags: string[] }>;
  circuitTarget: string;
  proxyRunning: boolean;
  relayLocationData: Map<string, FingerPrintData>;
  connectionTime: number;
  isLoading: boolean;
  groupedProcesses: GroupedProcessInfo[];
  fetchInitialData: () => void;
  handleStartProxy: () => void;
  handleStopProxy: () => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  proxyPort: number;
  anyonePort: number;
  relayData: RelayData | null;
  numberOfRelays: number;
  proxyRules: ProxyRule[];
  handleAddProxyRule: (rule: Omit<ProxyRule, 'id'>) => void;
  handleEditProxyRule: (rule: ProxyRule) => void;
  handleDeleteProxyRule: (ruleId: string) => void;
  handleToggleProxyRule: (ruleId: string) => void;
  handleToggleAllProxyRules: (enabled: boolean) => void;
  windowSize: { width: number; height: number };
  screenSize: { width: number; height: number };
  appBooted: boolean;
  showAnimations: boolean;
  setShowAnimations: (showAnimations: boolean) => void;
  globalExitCountry: string | null;
  setGlobalExitCountry: (country: string | null) => Promise<void>;
}

interface GroupedProcessInfo {
  processName: string;
  friendlyName: string;
  iconPath: string | null;
  count: number;
  pids: number[];
  remoteAddresses: string[];
  remotePorts: number[];
  protected: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [appBooted, setAppBooted] = useState<boolean>(false);
  const [realIP, setRealIP] = useState<string | null>("");
  const [relayData, setRelayData] = useState<RelayData | null>(null);

  const [proxyIP, setProxyIP] = useState<string | null>("-");
  const [realLocation, setRealLocation] = useState<LocationData | null>(null);
  const [proxyLocation, setProxyLocation] = useState<LocationData | null>(null);
  const [relayLocation, setRelayLocation] = useState<LocationData | null>(null);
  const [circuitHopCountries, setCircuitHopCountries] = useState<string[]>([]);
  const [circuitHopCoordinates, setCircuitHopCoordinates] = useState<Array<{ latitude: number; longitude: number } | null>>([]);
  const [circuitHopDetails, setCircuitHopDetails] = useState<Array<{ fingerprint: string; nickname: string; ip: string; country: string; bandwidth: number; flags: string[] }>>([]);
  const [circuitTarget, setCircuitTarget] = useState<string>('');
  const [proxyRunning, setProxyRunning] = useState<boolean>(false);
  const [connectionTime, setConnectionTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null); // To control the timer
  const [groupedProcesses, setGroupedProcesses] = useState<
    GroupedProcessInfo[]
  >([]);
  const [proxyPort, setProxyPort] = useState<number>(9050); // Default proxy port - same as anon port (direct socks proxy without proxy chains)
  const [anyonePort, setAnyonePort] = useState<number>(9050); // Default anyone port
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAnimations, setShowAnimations] = useState<boolean>(true);
  const [relayLocationData, setRelayLocationData] = useState<
    Map<string, FingerPrintData>
  >(new Map());
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 400,
    height: 700,
  });
  const [screenSize, setScreenSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });
  const [proxyRules, setProxyRules] = useState<ProxyRule[]>([]);
  const [numberOfRelays, setNumberOfRelays] = useState<number>(0);
  const [globalExitCountry, setGlobalExitCountryState] = useState<string | null>(null);

  const windowSizeRef = useRef(windowSize);

  const fetchInitialData = async () => {
    setIsLoading(true);
    // wait 2 seconds to get the data
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (typeof window !== "undefined" && window.ipc) {
      const fetchScreen = await window.ipc.getScreenSize();
      setScreenSize(fetchScreen);

      const proxyState = await window.ipc.isProxyRunning();
      setProxyRunning(proxyState);

      const proxyRules = await window.ipc.getProxyRules();
      setProxyRules(proxyRules);
      console.log(proxyRules, "proxyRules");

      // proxy is running
      if (proxyState) {
        const proxyIp = await window.ipc.checkIP(true);
        console.log(proxyIp, "proxyIp");
        setProxyIP(proxyIp);
        const proxyLoc = await window.ipc.getGeolocation(proxyIp);
        // add timeout to get location
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setProxyLocation(proxyLoc);
        const port = await window.ipc.getProxyPort();
        setProxyPort(port);
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const anonPort = await window.ipc.getAnonPort();
        setAnyonePort(anonPort);

        const relayData = await window.ipc.getRelayData();
        console.log(relayData, "relayData");
        setRelayData(relayData);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const relayLoc = await window.ipc.getGeolocation(relayData?.ip);
        setRelayLocation(relayLoc);

        const numberOfRelays = relayData.numberOfRelays;
        setNumberOfRelays(numberOfRelays);
      }

      setIsLoading(false);
      setAppBooted(true);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.ipc) {
      window.ipc.getShowAnimations().then((showAnimations) => {
        setShowAnimations(showAnimations);
      });
    }
  }, [showAnimations]);

  useEffect(() => {
    // Update the ref whenever windowSize state changes
    windowSizeRef.current = windowSize;
  }, [windowSize]);

  useEffect(() => {
    fetchInitialData();
    if (typeof window !== "undefined" && window.ipc) {
      window.ipc.getGlobalExitCountry().then(setGlobalExitCountryState);
      const removeGlobalExitCountryListener = window.ipc.onGlobalExitCountryChanged(setGlobalExitCountryState);

      // Set up IPC listeners
      const removeProxyStartedListener = window.ipc.onProxyStarted(() => {
        setProxyRunning(true);
        setIsLoading(false);
        // Proxy IP is pushed by main process via proxy-ip-changed once ready.
        // Update the port immediately since it's already known.
        window.ipc.getProxyPort().then((port) => setProxyPort(port));

        // check relay IP
        window.ipc.getRelayData().then((relayData) => {
          setRelayData(relayData);
          console.log(relayData, "relayData");
          setNumberOfRelays(relayData?.numberOfRelays);
          window.ipc
            .getGeolocation(relayData?.ip)
            .then(async (location) => {
              setRelayLocation(location);
              await new Promise((resolve) => setTimeout(resolve, 5000));
            });
        });
      });

      const removeProxychangeListener = window.ipc.onProxyIPChanged((ip) => {
        console.log(ip, "proxyIp");
        setProxyIP(ip);
        window.ipc.getGeolocation(ip).then(async (location) => {
          setProxyLocation(location);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        });
      });

      const removeRealIPListener = window.ipc.onRealIPChanged((ip) => {
        console.log(ip, "realIp");
        setRealIP(ip);
        window.ipc.getGeolocation(ip).then(async (location) => {
          setRealLocation(location);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        });
      });

      const removeWindowSizeListener = window.ipc.onWindowResize(
        (height, width) => {
          // Access the latest windowSize from the ref
          const currentWindowSize = windowSizeRef.current;

          // Clamp to nearest 50
          const newHeight = Math.round(height / 50) * 50;
          const newWidth = Math.round(width / 50) * 50;

          // Only update state if the new values are different from the current ones
          if (
            newHeight !== currentWindowSize.height ||
            newWidth !== currentWindowSize.width
          ) {
            console.log("Updating window size state");
            setWindowSize({ height: newHeight, width: newWidth });
          }

          // Sync expand/collapse arrow with manual window resize.
          // Minimized size is 400×700; anything meaningfully larger = expanded.
          const MINIMIZED_WIDTH = 400;
          const MINIMIZED_HEIGHT = 700;
          const TOLERANCE = 50;
          if (width > MINIMIZED_WIDTH + TOLERANCE || height > MINIMIZED_HEIGHT + TOLERANCE) {
            setIsExpanded(true);
          } else {
            setIsExpanded(false);
          }
        }
      );

      const removeRelayIPListener = window.ipc.onRelayIPChanged(
        (relayDataNew: RelayData) => {
          console.log(relayData, "relayData");
          setRelayData(relayData);
          window.ipc
            .getGeolocation(relayDataNew?.ip)
            .then(async (location) => {
              setRelayLocation(location);
              await new Promise((resolve) => setTimeout(resolve, 5000));
            });
        }
      );

      const removeCircuitPathListener = window.ipc.onCircuitPathUpdated((data) => {
        setCircuitHopCountries(data.hopCountries);
        setCircuitHopCoordinates(data.hopCoordinates);
        setCircuitHopDetails(data.hopDetails ?? []);
        setCircuitTarget(data.target ?? '');
      });

      // proxy port change listener
      const removeProxyPortListener = window.ipc.onProxyPortChanged((port) => {
        setProxyPort(port);
      });

      const removeAnyonePortListener = window.ipc.onAnonPortChanged((port) => {
        setAnyonePort(port);
      });

      const removeProxyStoppedListener = window.ipc.onProxyStopped(() => {
        setProxyRunning(false);
        setIsLoading(false);
        setProxyIP(null);
        setRelayData(null);
        setRelayLocation(null);
        setProxyLocation(null);
        setGroupedProcesses([]);
        setCircuitHopCountries([]);
        setCircuitHopCoordinates([]);
      });

      const removeProxyErrorListener = window.ipc.onProxyError(async (message) => {
        setIsLoading(false);
        const isTray = typeof window !== "undefined" && window.location.pathname.includes("tray");
        if (isTray) {
          // Only show alert if main window is minimized
          const minimized = await window.ipc.isMainWindowMinimized();
          if (minimized) {
            alert(`Proxy Error: ${message}`);
          }
        } else {
          alert(`Proxy Error: ${message}`);
        }
      });

      const removeAnonRunningErrorListener = window.ipc.onAnonRunningError(async (message) => {
        setIsLoading(false);
        const shouldKill = window.confirm(
          "Anyone process is already running in the background. Would you like to kill it and start a new one?"
        );
        
        if (shouldKill) {
          setIsLoading(true);
          try {
            await window.ipc.killAnonProcess();
            // After killing the process, try starting the proxy again
            await window.ipc.startProxy();
          } catch (error) {
            console.error("Error killing Anyone process:", error);
            alert("Failed to kill the Anyone process. Please try again.");
            setIsLoading(false);
          }
        }
      });

      // Cleanup function
      return () => {
        removeGlobalExitCountryListener();
        removeProxyStartedListener();
        removeProxyStoppedListener();
        removeProxyErrorListener();
        removeAnonRunningErrorListener();
        removeProxychangeListener();
        removeRealIPListener();
        removeRelayIPListener();
        removeCircuitPathListener();
        removeProxyPortListener();
        removeWindowSizeListener();
        removeAnyonePortListener();
      };
    }
  }, []);

  useEffect(() => {
    if (proxyRunning) {
      setTimer(
        setInterval(() => {
          setConnectionTime((prev) => prev + 1);
        }, 1000)
      );
    } else {
      if (timer) clearInterval(timer);
      setConnectionTime(0);
    }
    return () => {
      if (timer) clearInterval(timer); // Cleanup timer on unmount
    };
  }, [proxyRunning]);

  useEffect(() => {
    if (proxyRunning && window.ipc) {
      // Fetch connected processes initially
      fetchGroupedProcesses(proxyPort);

      // Set up interval to refresh the list every 5 seconds
      const intervalId = setInterval(() => {
        fetchGroupedProcesses(proxyPort);
      }, 5000);

      // Cleanup interval on unmount
      return () => clearInterval(intervalId);
    } else {
      setGroupedProcesses([]);
    }
  }, [proxyRunning]);

  const fetchGroupedProcesses = async (port: number) => {
    try {
      const processes: GroupedProcessInfo[] =
        await window.ipc.getGroupedConnectedProcesses(port);
      const updatedProcesses = await Promise.all(
        processes.map(async (proc) => {
          if (proc.iconPath) {
            // Fetch the base64 image using IPC
            const base64Image = await window.ipc.getIcon(proc.iconPath);
            return { ...proc, iconPath: base64Image };
          }
          return proc;
        })
      );
      setGroupedProcesses(updatedProcesses);
    } catch (error) {
      console.error("Error fetching grouped processes:", error);
    }
  };

  const handleStartProxy = async () => {
    setIsLoading(true);
    if (!window.ipc) {
      console.error("IPC not available");
      setIsLoading(false);
      return;
    }
    await window.ipc.startProxy();
  };

  const handleStopProxy = async () => {
    setIsLoading(true);
    if (!window.ipc) {
      console.error("IPC not available");
      setIsLoading(false);
      return;
    }
    await window.ipc.stopProxy();
  };

  const handleAddProxyRule = async (rule: Omit<ProxyRule, 'id'>) => {
    setIsLoading(true);
    if (!window.ipc) {
      console.error("IPC not available");
      setIsLoading(false);
      return;
    }
    await window.ipc.addNewProxyRule(rule);
    const proxyRules = await window.ipc.getProxyRules();
    setProxyRules(proxyRules);
    setIsLoading(false);
  };

  const handleEditProxyRule = async (rule: ProxyRule) => {
    setIsLoading(true);
    if (!window.ipc) {
      console.error("IPC not available");
      setIsLoading(false);
      return;
    }
    await window.ipc.editProxyRule(rule);
    const proxyRules = await window.ipc.getProxyRules();
    setProxyRules(proxyRules);
    setIsLoading(false);
  };

  const setGlobalExitCountry = async (country: string | null) => {
    await window.ipc.setGlobalExitCountry(country);
    setGlobalExitCountryState(country);
  };

  const handleDeleteProxyRule = async (ruleId: string) => {
    setIsLoading(true);
    if (!window.ipc) {
      console.error("IPC not available");
      setIsLoading(false);
      return;
    }
    await window.ipc.deleteProxyRule(ruleId);
    const proxyRules = await window.ipc.getProxyRules();
    setProxyRules(proxyRules);
    setIsLoading(false);
  };

  const handleToggleProxyRule = async (ruleId: string) => {
    if (!window.ipc) {
      console.error("IPC not available");
      return;
    }
    await window.ipc.toggleProxyRule(ruleId);
    const proxyRules = await window.ipc.getProxyRules();
    setProxyRules(proxyRules);
  };

  const handleToggleAllProxyRules = async (enabled: boolean) => {
    if (!window.ipc) {
      console.error("IPC not available");
      return;
    }
    await window.ipc.toggleAllProxyRules(enabled);
    const proxyRules = await window.ipc.getProxyRules();
    setProxyRules(proxyRules);
  };

  return (
    <AppContext.Provider
      value={{
        realIP,
        proxyIP,
        relayData,
        numberOfRelays,
        realLocation,
        proxyLocation,
        relayLocation,
        circuitHopCountries,
        circuitHopCoordinates,
        circuitHopDetails,
        circuitTarget,
        proxyRunning,
        connectionTime,
        isLoading,
        groupedProcesses,
        fetchInitialData,
        handleStartProxy,
        handleStopProxy,
        isExpanded,
        setIsExpanded,
        proxyPort,
        anyonePort,
        relayLocationData,
        windowSize,
        screenSize,
        proxyRules,
        handleAddProxyRule,
        handleEditProxyRule,
        handleDeleteProxyRule,
        handleToggleProxyRule,
        handleToggleAllProxyRules,
        appBooted,
        showAnimations,
        setShowAnimations,
        globalExitCountry,
        setGlobalExitCountry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
