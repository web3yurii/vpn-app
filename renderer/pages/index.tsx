// renderer/pages/index.tsx
import React, { useState } from "react";
import dynamic from "next/dynamic";
import GlobalExitCountrySelector from "../components/GlobalExitCountrySelector";
import {
  Box,
  Stack,
  useColorModeValue,
  Flex,
  Grid,
  GridItem,
  Button,
} from "@chakra-ui/react";
import { useAppContext } from "../context/AppProvider";
import { motion } from "framer-motion"; // Import framer-motion

const AnimatedButton = dynamic(() => import("../components/AnimatedButton"), {
  ssr: false,
});

const IPCard = dynamic(() => import("../components/IPCard"), {
  ssr: false,
});

const ProxyStatus = dynamic(() => import("../components/ProxyStatus"), {
  ssr: false,
});

const GroupedProcesses = dynamic(
  () => import("../components/GroupedProcesses"),
  {
    ssr: false,
  }
);

const GlobeComponent = dynamic(
  () => import("../components/Globe/GlobeComponent"),
  {
    ssr: false,
  }
);

function ExpandedHomePage() {
  const {
    appBooted,
    realIP,
    proxyIP,
    realLocation,
    proxyLocation,
    relayLocation,
    proxyRunning,
    isLoading,
    groupedProcesses,
    connectionTime,
    handleStartProxy,
    handleStopProxy,
    screenSize,
    numberOfRelays,
    showAnimations,
    globalExitCountry,
    setGlobalExitCountry,
  } = useAppContext();

  const bgColor = useColorModeValue("gray.100", "#18181B");
  const cardBgColor = useColorModeValue("white", "#18181B");
  const headerBgColor = useColorModeValue("teal.500", "#131315");
  const headerTextColor = useColorModeValue("black", "white");
  const ipcCardText = useColorModeValue("teal.500", "#27D7F2");
  const menuTextColor = useColorModeValue("black", "white");

  const mainContainerBgColor = useColorModeValue(
    "radial-gradient(164.53% 66.45% at 0% 100%, rgb(87 224 245 / 33%) 0%, rgb(0 0 0 / 13%) 100%), rgb(255 255 255 / 33%)",

    "radial-gradient(164.53% 66.45% at 0% 100%, rgba(87, 224, 245, 0.10) 0%, rgba(0, 0, 0, 0.10) 100%), rgba(24, 24, 27, 0.50)"
  );
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.5,
        when: "beforeChildren",
        staggerChildren: 0.3,
      },
    },
  };

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const [showMore, setShowMore] = useState(false);

  return (
    <Box
      minH="100vh"
      bg={bgColor}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        w="100%"
        h="100vh"
        bg={cardBgColor}
        borderRadius="md"
        boxShadow="lg"
        overflow="hidden"
        position="relative"
      >
        {/* Header */}
        {/* <Box zIndex={1}>
          <AppHeader
            expanded={false}
            showMenu={true} // Set to false if you don't want the menu
            bgColor={bgColor}
            headerBgColor={headerBgColor}
            headerTextColor={headerTextColor}
            menuTextColor={menuTextColor}
            onExpandToggle={() => {
              if (window.ipc) {
                window.ipc.minimizeExpandedApp();
                setIsExpanded(false);
                // router.push("/");
              }
            }}
            onSettingsClick={() => {
              if (window.ipc) {
                window.ipc.openSettingsWindow();
              }
            }}
            onQuitClick={() => {
              if (window.ipc) {
                window.ipc.quitApp();
              }
            }}
          />
        </Box> */}

        {/* Main Content */}
        <motion.div variants={childVariants}>
          <Grid
            templateColumns={"400px 1fr"}
            templateRows="repeat(1, 1fr)"
            gap={0}
            h="100vh"
            overflow={"hidden"}
            backgroundImage="radial-gradient(#2f4e5054 0.8px, transparent 0)"
            backgroundSize="12px 12px"
          >
            <GridItem
              colSpan={1}
              rowSpan={1}
              h="100vh"
              overflow={"hidden"}
              p="0px"
            >
              <Box
                p={0}
                textAlign="center"
                overflowY="hidden"
                h="calc(100%)"
                border="1px solid rgba(255, 255, 255, 0.04)"
                borderRadius="6px"
                background={mainContainerBgColor}
              >
                <Stack
                  spacing={4}
                  align="center"
                  justifyContent="flex-start"
                  h="100%"
                >
                  {/* Connection Status */}

                  {/* IP Addresses */}
                  <Flex
                    textAlign="center"
                    justify={"center"}
                    align={"flex-start"}
                    gap="1"
                    zIndex={1}
                    position="relative"
                    p=" 0px"
                    w="100%"
                  >
                    <Box
                      position="absolute"
                      bottom={0}
                      left={0}
                      width="100%"
                      height="1px"
                      background="linear-gradient(to right, rgba(22, 81, 103, 0), rgba(22, 81, 103, 0.8), rgba(22, 81, 103, 0))"
                    />
                    {proxyRunning ? (
                      <IPCard
                        label="Proxy IP"
                        value={proxyIP || "-"}
                        bgColor={bgColor}
                        menuTextColor={menuTextColor}
                        headerBgColor={ipcCardText}
                        status="Anyone"
                      />
                    ) : (
                      <IPCard
                        label="Local IP"
                        value={realIP || "Loading..."}
                        bgColor={bgColor}
                        menuTextColor={menuTextColor}
                        headerBgColor={ipcCardText}
                        status="Not Anyone"
                      />
                    )}

                    {/* <IPCard
                        label="Relay IP"
                        value={relayIP || "-"}
                        bgColor={bgColor}
                        menuTextColor={menuTextColor}
                        headerBgColor={ipcCardText}
                      /> */}
                  </Flex>

                  {/* Connect/Disconnect Button */}
                  <AnimatedButton
                    proxyRunning={proxyRunning}
                    handleStartProxy={handleStartProxy}
                    handleStopProxy={handleStopProxy}
                    isLoading={isLoading}
                    expanded={true}
                  />

                  <GlobalExitCountrySelector
                    globalExitCountry={globalExitCountry}
                    setGlobalExitCountry={setGlobalExitCountry}
                    menuTextColor={menuTextColor}
                    headerBgColor={ipcCardText}
                  />

                  <Flex
                    flexDirection={"column"}
                    justify={"center"}
                    gap="0px"
                    w="100%"
                    alignItems="stretch"
                  >
                    <ProxyStatus
                      appBooted={appBooted}
                      isLoading={isLoading}
                      proxyRunning={proxyRunning}
                      realLocation={realLocation}
                      relayLocation={relayLocation}
                      proxyLocation={proxyLocation}
                      bgColor={bgColor}
                      showCountries={true}
                      menuTextColor={menuTextColor}
                      connectionTime={connectionTime}
                      expanded={true}
                      handleStartProxy={handleStartProxy}
                      handleStopProxy={handleStopProxy}
                      numberOfRelays={numberOfRelays}
                    />
                  </Flex>
                </Stack>
              </Box>
            </GridItem>

            {/* {realLocation && proxyLocation && relayLocation && proxyRunning && ( */}
            {showAnimations && (
            <GridItem colSpan={1} rowSpan={1} overflowX={"visible"}>
              <Flex
                justifyContent="center"
                alignItems="center"
                position="relative"
                h="100%"
                w="100%"
                overflow="hidden"
                bg="black" // Optional: Add a background color to make centering more visible
              >
                <Box
                  position="absolute"
                  h={screenSize.height} // Fixed height
                  w={screenSize.width * 0.8} // Fixed widthb
                  overflow="hidden"
                  border="1px solid rgba(22, 81, 103, 0.8)" // Optional border for debugging
                >
                  <GlobeComponent
                    realLocation={realLocation}
                    proxyLocation={proxyLocation}
                    relayLocation={relayLocation}
                    rotating={false}
                    enableOrbitControls={true}
                    initialZoom={5}
                  />
                  </Box>
                </Flex>
              </GridItem>
            )}

            {proxyLocation && (
              <GridItem
                colSpan={1}
                rowSpan={1}
                maxH="100vh"
                overflow={"hidden"}
                p="10px 5px 5px 15px"
                position="absolute"
                left="400px"
              >
                <Flex
                  bgColor={headerBgColor}
                  height="max-content"
                  w="300px"
                  justifyContent={"center"}
                  align="center"
                  borderRadius="6px"
                >
                  <Button
                    borderRadius="6px"
                    bg="none"
                    onClick={() =>
                      showMore
                        ? setShowMore(!showMore)
                        : setTimeout(() => setShowMore(!showMore), 300)
                    }
                    w="300px"
                  >
                    {!showMore ? "Show Processes" : "Hide Processes"}
                  </Button>
                </Flex>
                {showMore && (
                  <GroupedProcesses
                    groupedProcesses={groupedProcesses}
                    proxyRunning={proxyRunning}
                    bgColor={bgColor}
                    showMore={showMore}
                    setShowMore={setShowMore}
                    isExpanded={true}
                    total={groupedProcesses.length}
                  />
                )}
              </GridItem>
            )}
          </Grid>
        </motion.div>
      </Box>
    </Box>
  );
}

export default ExpandedHomePage;
