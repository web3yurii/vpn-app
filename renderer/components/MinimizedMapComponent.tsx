// src/components/MinimizedMapComponent.tsx
import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

interface MinimizedMapComponentProps {
  circuitHopCountries: string[];
  numberOfRelays: number;
}

const countryCodeToEmoji = (countryCode: string) => {
  if (!countryCode || countryCode === '??') return "🌐";
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
};

const MinimizedMapComponent: React.FC<MinimizedMapComponentProps> = ({
  circuitHopCountries,
  numberOfRelays,
}) => {
  const hops = circuitHopCountries.length > 0 ? circuitHopCountries : null;

  return (
    <Box>
      <Flex justifyContent="center" alignItems="center" gap={1} flexWrap="wrap">
        {hops ? (
          hops.map((country, i) => (
            <React.Fragment key={i}>
              <Text fontSize="2xl">{countryCodeToEmoji(country)}</Text>
              {i < hops.length - 1 && (
                <Text fontSize="xs" color="gray.500">→</Text>
              )}
            </React.Fragment>
          ))
        ) : (
          <>
            <Text fontSize="2xl">🌐</Text>
            <Text fontSize="xs" color="gray.500">→</Text>
            <Text fontSize="2xl">🌐</Text>
          </>
        )}
      </Flex>
      {numberOfRelays > 0 && (
        <Text textAlign="center" fontSize="xs" color="gray.400" mt={1}>
          {numberOfRelays} relay{numberOfRelays !== 1 ? "s" : ""} available
        </Text>
      )}
    </Box>
  );
};

export default MinimizedMapComponent;
