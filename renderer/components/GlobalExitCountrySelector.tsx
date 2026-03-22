import { Box, Select, Text, Flex } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { ALL_COUNTRIES } from "../utils/countries";

interface Props {
  globalExitCountry: string | null;
  setGlobalExitCountry: (country: string | null) => Promise<void>;
  menuTextColor: string;
  headerBgColor: string;
}

const GlobalExitCountrySelector: React.FC<Props> = ({
  globalExitCountry,
  setGlobalExitCountry,
  menuTextColor,
  headerBgColor,
}) => {
  const [availableCountryCodes, setAvailableCountryCodes] = useState<string[]>([]);

  useEffect(() => {
    window.ipc.getAvailableCountries().then(setAvailableCountryCodes).catch(() => {});
  }, []);

  const displayCountries = availableCountryCodes.length > 0
    ? ALL_COUNTRIES.filter(c => availableCountryCodes.includes(c.code))
    : ALL_COUNTRIES;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setGlobalExitCountry(value || null);
  };

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
      <Select
        size="sm"
        value={globalExitCountry ?? ""}
        onChange={handleChange}
        bg="rgba(24, 24, 27, 0.70)"
        border="1px solid"
        borderColor="gray.600"
        color={menuTextColor}
        borderRadius="md"
        _focus={{
          borderColor: headerBgColor,
          boxShadow: `0 0 0 1px ${headerBgColor}`,
        }}
      >
        <option value="" style={{ background: "#18181b" }}>Any country</option>
        {displayCountries.map(c => (
          <option key={c.code} value={c.code} style={{ background: "#18181b" }}>
            {c.code.toUpperCase()} — {c.name}
          </option>
        ))}
      </Select>
    </Box>
  );
};

export default GlobalExitCountrySelector;
