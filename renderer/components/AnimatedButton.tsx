// AnimatedButton.tsx
import { Box } from "@chakra-ui/react";
import React from "react";
import dynamic from "next/dynamic";

import Logo from "./LottieAnimation/Logo";

const BgAnimation = dynamic(() => import("./BgAnimation/BgAnimation"), {
  ssr: false,
});

interface AnimatedButtonProps {
  proxyRunning: boolean;
  handleStartProxy: () => void;
  handleStopProxy: () => void;
  isLoading: boolean;
  expanded: boolean;
  appBooted: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  proxyRunning,
  handleStartProxy,
  handleStopProxy,
  isLoading,
  expanded,
  appBooted,
}) => {
  const showAnimation = appBooted && (isLoading || proxyRunning);

  return (
    <Box
      width="100%"
      height="320px"
      mt="32px"
      mb="8px"
      overflow="visible"
      cursor="pointer"
      onClick={proxyRunning || isLoading ? handleStopProxy : handleStartProxy}
      zIndex={0}
      display="flex"
      justifyContent={"center"}
      alignItems={"center"}
    >
      {/* Background Animation */}
      {showAnimation && (
        <BgAnimation autoplay={true} loop={true} expanded={expanded} />
      )}

      {/* Clickable Content */}
      {!showAnimation && (
        <Box position="relative" zIndex={1} width="250px" height="250px">
          <Logo />
        </Box>
      )}
    </Box>
  );
};

export default AnimatedButton;
