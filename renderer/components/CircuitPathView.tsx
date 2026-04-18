import React from "react";
import { Box, Flex, Text, VStack, Divider } from "@chakra-ui/react";
import { countryFlag } from "../utils/countries";
import { useAppContext } from "../context/AppProvider";

const ROLES = ["Entry", "Middle", "Exit"];

const HopNode: React.FC<{ label: string }> = ({ label }) => (
  <Flex
    w="28px"
    h="28px"
    borderRadius="full"
    border="2px solid"
    borderColor="#27D7F2"
    bg="rgba(39,215,242,0.08)"
    align="center"
    justify="center"
    flexShrink={0}
  >
    <Text fontSize="7px" color="#27D7F2" fontWeight="700" textAlign="center" lineHeight="1.1" px="2px">
      {label}
    </Text>
  </Flex>
);

const Connector: React.FC = () => (
  <Box flex={1} h="2px" bg="rgba(39,215,242,0.35)" alignSelf="center" minW="8px" />
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Flex align="baseline" gap={2} w="100%" minW={0}>
    <Text fontSize="11px" color="gray.500" flexShrink={0} w="82px">{label}</Text>
    <Box flex={1} minW={0} overflow="hidden">
      <Text fontSize="11px" color="gray.300" fontFamily="mono" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {value}
      </Text>
    </Box>
  </Flex>
);

const CircuitPathView: React.FC = () => {
  const { circuitHopCountries, circuitHopDetails, proxyRunning } = useAppContext();

  const hopLabels = ["YOU", ...ROLES.slice(0, circuitHopCountries.length), "API"];

  return (
    <Box w="100%" h="100%" overflowY="auto" px={4} py={3}
      css={{
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-thumb": { background: "rgba(39,215,242,0.3)", borderRadius: "2px" },
      }}
    >
      <Text fontSize="10px" color="gray.600" fontWeight="600" letterSpacing="0.1em" textTransform="uppercase" mb={3}>
        Last Path Used
      </Text>

      {!proxyRunning || circuitHopCountries.length === 0 ? (
        <Flex direction="column" align="center" justify="center" h="80px" gap={1}>
          <Text fontSize="12px" color="gray.600">No circuit data yet</Text>
          <Text fontSize="11px" color="gray.700">Browse something with the proxy running</Text>
        </Flex>
      ) : (
        <>
          {/* Horizontal hop path */}
          <Flex align="center" mb={3} w="100%" overflow="hidden">
            {hopLabels.map((label, i) => (
              <React.Fragment key={i}>
                <HopNode label={label} />
                {i < hopLabels.length - 1 && <Connector />}
              </React.Fragment>
            ))}
          </Flex>

          {/* Relay detail cards */}
          <VStack spacing={0} align="stretch" divider={<Divider borderColor="rgba(39,215,242,0.1)" />}>
            {circuitHopDetails.map((hop, i) => (
              <Box key={i} py={3}>
                <VStack spacing="3px" align="stretch">
                  <DetailRow label="Role" value={ROLES[i] ?? `Hop ${i + 1}`} />
                  <DetailRow label="Nickname" value={hop.nickname} />
                  <DetailRow label="IP" value={hop.ip} />
                  <DetailRow
                    label="Country"
                    value={hop.country !== '??' ? `${countryFlag(hop.country)} ${hop.country}` : '??'}
                  />
                  <DetailRow label="Fingerprint" value={hop.fingerprint} />
                  <DetailRow label="Bandwidth" value={hop.bandwidth > 0 ? hop.bandwidth.toLocaleString() : '?'} />
                  {hop.flags.length > 0 && (
                    <DetailRow label="Flags" value={hop.flags.join(', ')} />
                  )}
                </VStack>
              </Box>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
};

export default CircuitPathView;
