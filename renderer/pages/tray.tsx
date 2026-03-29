import React, { useEffect } from "react";
import { AppProvider, useAppContext } from "../context/AppProvider";
import {
  Box,
  Stack,
  useColorModeValue,
  Flex,
  useColorMode,
  Grid,
  GridItem,
  Button,
} from "@chakra-ui/react";
import dynamic from "next/dynamic"; // Import dynamic from Next.js
import App from "next/app";

const IPCardTray = dynamic(() => import("../components/IPCardTray"), {
  ssr: false,
});

const ProxyStatus = dynamic(() => import("../components/ProxyStatus"), {
  ssr: false,
});

const GlobeComponent = dynamic(
  () => import("../components/Globe/GlobeComponent"),
  {
    ssr: false,
  }
);

const ExitButton = dynamic(() => import("../components/ExitButton"), {
  ssr: false,
});

export default function TrayPage() {
  const {
    appBooted,
    realIP,
    proxyRunning,
    proxyIP,
    handleStartProxy,
    handleStopProxy,
    isLoading,
    realLocation,
    relayLocation,
    proxyLocation,
    connectionTime,
    numberOfRelays,
    circuitHopCountries,
    circuitHopCoordinates,
  } = useAppContext();

  const CloseApp = async () => {
    await window.ipc.quitApp();
  };

  const showWindow = async () => {
    await window.ipc.showMainWindow();
  };

  const bgColor = useColorModeValue("gray.100", "#18181B");
  const ipcCardText = useColorModeValue("teal.500", "#27D7F2");
  const menuTextColor = useColorModeValue("black", "white");

  return (
    <AppProvider>
      <Box
        display="flex"
        flexDirection="column"
        height="100vh"
        backgroundImage="radial-gradient(#2f4e5054 0.8px, transparent 0)"
        backgroundSize="12px 12px"
      >
        {proxyRunning ? (
          <IPCardTray
            label="Proxy IP"
            value={proxyIP || "-"}
            bgColor={bgColor}
            menuTextColor={menuTextColor}
            headerBgColor={ipcCardText}
            status="Anyone"
          />
        ) : (
          <IPCardTray
            label="Local IP"
            value={realIP || "Loading..."}
            bgColor={bgColor}
            menuTextColor={menuTextColor}
            headerBgColor={ipcCardText}
            status="Not Anyone"
          />
        )}
        <Button
          onClick={() => showWindow()}
          background="transparent"
          _hover={{ background: "transparent" }}
          flex="1"
          w="100%"
          flexGrow={1}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <GlobeComponent
            realLocation={realLocation}
            relayLocation={relayLocation}
            proxyLocation={proxyLocation}
            rotating={true}
            enableOrbitControls={false}
            initialZoom={3.7}
            circuitHopCountries={circuitHopCountries}
            circuitHopCoordinates={circuitHopCoordinates}
          />
        </Button>
        <ProxyStatus
          appBooted={appBooted}
          isLoading={isLoading}
          proxyRunning={proxyRunning}
          realLocation={realLocation}
          relayLocation={relayLocation}
          proxyLocation={proxyLocation}
          bgColor={bgColor}
          showCountries={false}
          menuTextColor={menuTextColor}
          connectionTime={connectionTime}
          expanded={true}
          handleStartProxy={handleStartProxy}
          handleStopProxy={handleStopProxy}
          numberOfRelays={numberOfRelays}
          circuitHopCountries={circuitHopCountries}
        />
        <ExitButton
          bgColor={bgColor}
          menuTextColor={menuTextColor}
          text="Exit"
          onClick={CloseApp}
        />
      </Box>
    </AppProvider>
  );
}
