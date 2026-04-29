import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  VStack,
  Textarea,
  HStack,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Flex,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { Rule } from "./RuleBox";
import { ALL_COUNTRIES } from "../utils/countries";
import CountrySelect from "./CountrySelect";
import FlagIcon from "./FlagIcon";

interface NewRuleBoxProps {
  isOpen: boolean;
  onClose: () => void;
  headerBgColor: string;
  onAddRule?: (rule: Omit<Rule, "id">) => void;
  onEditRule?: (rule: Rule) => void;
  currentRule?: Rule;
}

export const NewRuleBox: React.FC<NewRuleBoxProps> = ({
  isOpen,
  onClose,
  headerBgColor,
  onAddRule,
  onEditRule,
  currentRule,
}) => {
  const [title, setTitle] = useState(currentRule?.title || "");
  const [destinations, setDestinations] = useState(currentRule?.destinations.join("\n") || "");
  const [hops, setHops] = useState(currentRule?.hops || 2);
  const [entryCountries, setEntryCountries] = useState(currentRule?.entryCountries.join(",") || "");
  const [exitCountries, setExitCountries] = useState<string[]>(currentRule?.exitCountries.map(c => c.toLowerCase()) ?? []);
  const [availableCountryCodes, setAvailableCountryCodes] = useState<string[]>([]);

  useEffect(() => {
    window.ipc.getAvailableCountries().then(setAvailableCountryCodes).catch(() => {});
  }, []);

  // If we have SDK-provided countries, restrict to those; otherwise show all world countries
  const displayCountries = availableCountryCodes.length > 0
    ? ALL_COUNTRIES.filter(c => availableCountryCodes.includes(c.code))
    : ALL_COUNTRIES;

  useEffect(() => {
    if (currentRule) {
      setTitle(currentRule.title);
      setDestinations(currentRule.destinations.join("\n"));
      setHops(currentRule.hops);
      setEntryCountries(currentRule.entryCountries.join(","));
      setExitCountries(currentRule.exitCountries.map(c => c.toLowerCase()));
    }
  }, [currentRule]);

  const handleAddExitCountry = (code: string) => {
    if (code && !exitCountries.includes(code)) {
      setExitCountries([...exitCountries, code]);
    }
  };

  const handleRemoveExitCountry = (code: string) => {
    setExitCountries(exitCountries.filter(c => c !== code));
  };

  const handleSubmit = () => {
    if (currentRule && onEditRule) {
      onEditRule({
        ...currentRule,
        title,
        destinations: destinations.split("\n").filter(d => d.trim() !== ""),
        hops,
        entryCountries: entryCountries.split(",").map(c => c.trim()).filter(c => c !== ""),
        exitCountries,
      });
    } else if (onAddRule) {
      onAddRule({
        title,
        destinations: destinations.split("\n").filter(d => d.trim() !== ""),
        hops,
        entryCountries: entryCountries.split(",").map(c => c.trim()).filter(c => c !== ""),
        exitCountries,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setTitle("");
    setDestinations("");
    setHops(2);
    setEntryCountries("");
    setExitCountries([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="rgba(24, 24, 27, 0.90)"
        boxShadow="0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset"
        border="1px solid"
        borderColor="gray.600"
      >
        <ModalHeader color={headerBgColor}>{currentRule ? "Edit Rule" : "Add New Rule"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel color="gray.300">Title</FormLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter rule title"
                bg="rgba(24, 24, 27, 0.70)"
                border="1px solid"
                borderColor="gray.600"
                _focus={{
                  borderColor: headerBgColor,
                  boxShadow: `0 0 0 1px ${headerBgColor}`,
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel color="gray.300">Destinations (one per line)</FormLabel>
              <Textarea
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
                placeholder="e.g. anyone.io (one per line)"
                minH="100px"
                bg="rgba(24, 24, 27, 0.70)"
                border="1px solid"
                borderColor="gray.600"
                _focus={{
                  borderColor: headerBgColor,
                  boxShadow: `0 0 0 1px ${headerBgColor}`,
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel color="gray.300">Number of Hops</FormLabel>
              <NumberInput
                value={hops}
                onChange={(_, val) => setHops(val)}
                min={2}
                max={3}
                bg="rgba(24, 24, 27, 0.70)"
              >
                <NumberInputField
                  border="1px solid"
                  borderColor="gray.600"
                  _focus={{
                    borderColor: headerBgColor,
                    boxShadow: `0 0 0 1px ${headerBgColor}`,
                  }}
                />
                <NumberInputStepper>
                  <NumberIncrementStepper borderColor="gray.600" />
                  <NumberDecrementStepper borderColor="gray.600" />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            {/* <FormControl>
              <FormLabel color="gray.300">Entry Countries (comma-separated)</FormLabel>
              <Input
                value={entryCountries}
                onChange={(e) => setEntryCountries(e.target.value)}
                placeholder="US, UK, CA"
                bg="rgba(24, 24, 27, 0.70)"
                border="1px solid"
                borderColor="gray.600"
                _focus={{
                  borderColor: headerBgColor,
                  boxShadow: `0 0 0 1px ${headerBgColor}`,
                }}
              />
            </FormControl> */}

            <FormControl>
              <FormLabel color="gray.300">
                Exit Countries
                {availableCountryCodes.length === 0 && (
                  <Box as="span" fontSize="xs" color="gray.500" ml={2}>(all countries — start proxy to see available)</Box>
                )}
              </FormLabel>
              <CountrySelect
                value={null}
                onChange={(code) => { if (code) handleAddExitCountry(code); }}
                options={displayCountries.filter(c => !exitCountries.includes(c.code))}
                placeholder="Add Country"
                headerBgColor={headerBgColor}
              />
              {exitCountries.length > 0 && (
                <Wrap mt={2} spacing={2}>
                  {exitCountries.map(code => {
                    const country = ALL_COUNTRIES.find(c => c.code === code);
                    return (
                      <WrapItem key={code}>
                        <Tag
                          size="md"
                          borderRadius="full"
                          variant="solid"
                          bg="rgba(255,255,255,0.12)"
                          color="white"
                        >
                          <TagLabel>
                            <Flex as="span" align="center" gap={1} display="inline-flex">
                              <FlagIcon code={code} width={16} />
                              {code.toUpperCase()}{country ? ` — ${country.name}` : ""}
                            </Flex>
                          </TagLabel>
                          <TagCloseButton onClick={() => handleRemoveExitCountry(code)} />
                        </Tag>
                      </WrapItem>
                    );
                  })}
                </Wrap>
              )}
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isDisabled={!title || !destinations}
            >
              {currentRule ? "Save Changes" : "Add Rule"}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 