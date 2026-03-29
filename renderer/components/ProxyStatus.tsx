import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  Circle,
  Progress,
} from "@chakra-ui/react";
import MinimizedMapComponent from "./MinimizedMapComponent";

interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  countryCode: string;
}

interface ProxyStatusProps {
  appBooted: boolean;
  isLoading: boolean;
  proxyRunning: boolean;
  realLocation: LocationData;
  relayLocation: LocationData;
  proxyLocation: LocationData;
  bgColor: string;
  menuTextColor: string;
  connectionTime: number;
  showCountries: boolean;
  expanded: boolean;
  handleStartProxy: () => void;
  handleStopProxy: () => void;
  numberOfRelays: number;
  circuitHopCountries: string[];
}

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hrs} : ${mins} : ${secs}`;
};

const ProxyStatus: React.FC<ProxyStatusProps> = ({
  appBooted,
  isLoading,
  proxyRunning,
  realLocation,
  relayLocation,
  proxyLocation,
  bgColor,
  menuTextColor,
  connectionTime,
  expanded = false,
  handleStartProxy,
  handleStopProxy,
  showCountries,
  numberOfRelays,
  circuitHopCountries,
}) => {
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [hovered, setHovered] = React.useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ipc) {
      const removeProgressListener = window.ipc.onProxyProgress(
        (progress: number, message: string) => {
          setProgress(progress);
          setProgressMessage(message);
          setShowProgress(true);
        }
      );

      const removeStartedListener = window.ipc.onProxyStarted(() => {
        setShowProgress(false);
        setProgress(0);
        setProgressMessage("");
      });

      const removeStoppedListener = window.ipc.onProxyStopped(() => {
        setShowProgress(false);
        setProgress(0);
        setProgressMessage("");
      });

      const removeErrorListener = window.ipc.onProxyError(() => {
        setShowProgress(false);
        setProgress(0);
        setProgressMessage("");
      });

      return () => {
        removeProgressListener();
        removeStartedListener();
        removeStoppedListener();
        removeErrorListener();
      };
    }
  }, []);

  const statusText = !appBooted
    ? "App starting"
    : isLoading
    ? proxyRunning
      ? "Disconnecting"
      : "Connecting"
    : hovered
    ? proxyRunning
      ? "Disconnect"
      : "Connect"
    : proxyRunning
    ? "Connected"
    : "Click to Connect";

  const statusColor = !appBooted
    ? "yellow.500"
    : isLoading
    ? "red.500"
    : proxyRunning
    ? "green.500"
    : "red.500";

  return (
    <Box
      // bg={bgColor}
      // position={expanded ? "absolute" : "absolute"}
      // top={expanded ? "52%" : "52%"}
      w={"100%"}
      p="14px"
      borderLeft="none"
      borderRight={"none"}
      position={"relative"}
    >
      <Box
        position="absolute"
        top={0} // Apply the border to the bottom
        left={0}
        width="100%"
        height="1px" // Height of the border
        background="linear-gradient(to right, rgba(22, 81, 103, 0), rgba(22, 81, 103, 0.8), rgba(22, 81, 103, 0))"
      />
      <Box
        position="absolute"
        bottom={0} // Apply the border to the bottom
        left={0}
        width="100%"
        height="1px" // Height of the border
        background="linear-gradient(to right, rgba(22, 81, 103, 0), rgba(22, 81, 103, 0.8), rgba(22, 81, 103, 0))"
      />

      <Box
        display="flex"
        alignItems="center"
        justifyContent={"center"}
        gap={2}
        onClick={proxyRunning || isLoading ? handleStopProxy : handleStartProxy}
        _hover={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Circle size="10px" bg={statusColor} />
        <Text fontWeight="500" fontSize="14px" color={menuTextColor}>
          {statusText}
        </Text>
      </Box>

      {/* Progress Bar */}
      {showProgress && (
        <Box mb={1} display="flex" alignItems="center" justifyContent="center" flexDirection="column">
          <Progress
            value={progress}
            size="sm"
            mt={2}
            borderRadius="full"
            width="90%"
            isAnimated
            bg="rgba(255, 255, 255, 0.05)"
            sx={{
              '& > div': {
                background: 'linear-gradient(90deg, #00d4aa 0%, #00b4d8 50%, #0077b6 100%)',
                boxShadow: '0 0 15px rgba(0, 212, 170, 0.4)',
                borderRadius: 'full',
              }
            }}
          />
          <Text fontSize="xs" mt={2} textAlign="center" color={menuTextColor} fontWeight="medium">
            {progressMessage}
          </Text>
          <Text fontSize="xs" mt={1} textAlign="center" color="gray.400">
            {progress}%
          </Text>
        </Box>
      )}

      {/* Timer Display */}
      {proxyRunning && !isLoading && (
        <Box display="flex" alignItems="center" justifyContent={"center"}>
          <Text
            fontSize="24px"
            fontWeight="bold"
            mt={2}
            color={menuTextColor}
            textAlign="left"
          >
            {formatTime(connectionTime)}
          </Text>
        </Box>
      )}

      {realLocation && proxyLocation && showCountries && proxyRunning && (
        <Box
          width="100%"
          mt={3}
          zIndex={1}
          display="flex"
          alignItems="center"
          justifyContent={"center"}
          flexDirection={"column"}
        >
          {/* {!expanded && ( */}
          <MinimizedMapComponent
            circuitHopCountries={circuitHopCountries}
            numberOfRelays={numberOfRelays}
          />
          {/* )} */}
        </Box>
      )}
    </Box>
  );
};

export default ProxyStatus;
