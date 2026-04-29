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
  const [availableCountryCodes, setAvailableCountryCodes] = useState<string[]>([]);

  useEffect(() => {
    window.ipc.getAvailableCountries().then(setAvailableCountryCodes).catch(() => {});
  }, []);

  const displayCountries =
    availableCountryCodes.length > 0
      ? ALL_COUNTRIES.filter((c) => availableCountryCodes.includes(c.code))
      : ALL_COUNTRIES;

  return (
    <Box w="100%" px="14px" py="10px">
      <Flex align="center" justify="space-between" mb={2}>
        <Text fontSize="12px" color="gray.400" fontWeight="500" textTransform="uppercase" letterSpacing="0.05em">
          Exit Country
        </Text>
        {availableCountryCodes.length === 0 && (
          <Text fontSize="10px" color="gray.600">all countries</Text>
        )}
      </Flex>
      <CountrySelect
        value={globalExitCountry}
        onChange={(code) => setGlobalExitCountry(code)}
        options={displayCountries}
        headerBgColor={headerBgColor}
        includeAny
      />
    </Box>
  );
};

export default GlobalExitCountrySelector;
