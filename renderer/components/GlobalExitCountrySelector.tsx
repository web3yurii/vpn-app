import { Box, Text, Flex } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { ALL_COUNTRIES } from "../utils/countries";
import CountrySelect from "./CountrySelect";

interface Props {
  globalExitCountry: string | null;
  setGlobalExitCountry: (country: string | null) => Promise<void>;
  menuTextColor: string;
  headerBgColor: string;
}

const GlobalExitCountrySelector: React.FC<Props> = ({
  globalExitCountry,
  setGlobalExitCountry,
  headerBgColor,
}) => {
  const [availableCountries, setAvailableCountries] = useState<{ code: string; count: number }[]>([]);

  const fetchCountries = () => {
    window.ipc.getAvailableCountries().then(setAvailableCountries).catch(() => {});
  };

  useEffect(() => {
    fetchCountries();
    return window.ipc.onProxyStarted(fetchCountries);
  }, []);

  const displayCountries =
    availableCountries.length > 0
      ? availableCountries
          .map(({ code, count }) => {
            const found = ALL_COUNTRIES.find((c) => c.code === code);
            return found ? { ...found, count } : null;
          })
          .filter(Boolean)
      : ALL_COUNTRIES;

  const totalExits = availableCountries.reduce((sum, c) => sum + c.count, 0);
  const selectedEntry = globalExitCountry
    ? availableCountries.find((c) => c.code === globalExitCountry)
    : null;

  const relayHint = (() => {
    if (availableCountries.length === 0) return null;
    if (selectedEntry && selectedEntry.count > 0)
      return `${selectedEntry.count} exit relays`;
    if (!globalExitCountry && totalExits > 0)
      return `${totalExits} exits · ${availableCountries.length} countries`;
    return null;
  })();

  return (
    <Box w="100%" px="14px" py="10px">
      <Flex align="center" justify="space-between" mb={2}>
        <Text fontSize="12px" color="gray.400" fontWeight="500" textTransform="uppercase" letterSpacing="0.05em">
          Exit Country
        </Text>
        {relayHint ? (
          <Text fontSize="10px" color="gray.500">{relayHint}</Text>
        ) : availableCountries.length === 0 ? (
          <Text fontSize="10px" color="gray.600">all countries</Text>
        ) : null}
      </Flex>
      <CountrySelect
        value={globalExitCountry}
        onChange={(code) => setGlobalExitCountry(code)}
        options={displayCountries}
        headerBgColor={headerBgColor}
        includeAny
        anyCountryCount={totalExits > 0 ? totalExits : undefined}
      />
    </Box>
  );
};

export default GlobalExitCountrySelector;
