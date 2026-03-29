import {
  Flex,
  Text,
  Box,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Button,
  useDisclosure,
  VStack,
  HStack,
  Select,
  Switch,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { TbCopy, TbCopyCheck } from "react-icons/tb";
import { useState, useRef } from "react";
import { useAppContext } from "../context/AppProvider";
import { ipcMain } from "electron";
import { MdSecurity, MdRule, MdAdd } from "react-icons/md";
import { FiSettings } from "react-icons/fi";
import { SlArrowRight } from "react-icons/sl";
import { SlArrowLeft } from "react-icons/sl";
import { PortComponent } from "./PortComponent";
import { SettingsComponent } from "./SettingsComponent";
import { RuleBox, Rule } from "./RuleBox";
import { NewRuleBox } from "./NewRuleBox";

interface IPCardProps {
  label: string;
  value: string;
  bgColor: string;
  menuTextColor: string;
  headerBgColor: string;
  status: string;
}

const mockRules: Rule[] = [
  {
    id: '1',
    title: 'Default Rule',
    destinations: ['https://pornhub.com', 'and 7 more'],
    hops: 3,
    entryCountries: ['All'],
    exitCountries: ['All'],
    enabled: true,
  },
  {
    id: '2',
    title: 'Social Media Rule',
    destinations: ['https://facebook.com', 'and 3 more'],
    hops: 2,
    entryCountries: ['US', 'UK', 'CA'],
    exitCountries: ['FR', 'DE', 'NL'],
    enabled: true,
  },
];

const IPCard: React.FC<IPCardProps> = ({
  label,
  value,
  bgColor,
  menuTextColor,
  headerBgColor,
  status,
}) => {
  const {
    proxyPort,
    realIP,
    proxyRunning,
    isLoading,
    anyonePort,
    isExpanded: expanded,
    setIsExpanded,
    proxyRules,
    handleAddProxyRule,
    handleDeleteProxyRule,
    handleEditProxyRule,
    handleToggleProxyRule,
    handleToggleAllProxyRules,
  } = useAppContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { 
    isOpen: isSettingsOpen, 
    onOpen: onSettingsOpen, 
    onClose: onSettingsClose 
  } = useDisclosure();
  const {
    isOpen: isAddRuleOpen,
    onOpen: onAddRuleOpen,
    onClose: onAddRuleClose
  } = useDisclosure();

  const [isCopied, setIsCopied] = useState(false);
  const [newPort, setNewPort] = useState(proxyPort);
  const [newAnyonePort, setNewAnyonePort] = useState(anyonePort);
  const editingRuleRef = useRef<Rule | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);

    // Reset the icon after 2 seconds
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleAnyonePortChange = () => {
    if (!proxyRunning) {
      window.ipc.changeAnonPort(newAnyonePort);
      onClose();
    }
  };

  const handleExpandClick = () => {
    if (window.ipc) {
      window.ipc.expandApp();
      console.log("Expanding App");
    }
    setIsExpanded(!expanded);
  };

  const handleMinimizeClick = () => {
    if (window.ipc) {
      window.ipc.minimizeExpandedApp();
      console.log("Minimizing App");
    }
    setIsExpanded(!expanded);
  };

  const handleEditRule = (rule: Rule) => {
    editingRuleRef.current = rule;
    onAddRuleOpen();
  };

  const handleAddRule = (rule: Omit<Rule, "id">) => {
    handleAddProxyRule(rule);
    onAddRuleClose();
  };

  const handleUpdateRule = (updatedRule: Rule) => {
    handleEditProxyRule(updatedRule);
    editingRuleRef.current = null;
    onAddRuleClose();
  };

  return (
    <>
      <Flex
        flexDirection="row"
        justify="space-between"
        align="center"
        gap={1}
        padding="10px 15px"
        borderRadius="0px"
        background={bgColor}
        border="1px solid #1c2f30"
        borderLeft={"none"}
        borderRight={"none"}
        as={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          transition: "opacity 0.5s",
        }}
        w="100%"
      >
        <Text fontSize="xs" fontWeight="500" color={menuTextColor}>
          {label}
        </Text>
        <Flex gap="5px">
          <Text fontSize="xs" fontWeight="500" color={headerBgColor}>
            {value}
          </Text>
          {isCopied ? (
            <TbCopyCheck
              size="15px"
              color={menuTextColor}
              style={{ cursor: "pointer", marginTop: "2px" }}
            />
          ) : (
            <TbCopy
              size="14px"
              color={menuTextColor}
              style={{ cursor: "pointer", marginTop: "2px" }}
              onClick={handleCopy}
            />
          )}
        </Flex>

        <Box>
          {status === "Anyone" ? (
            <Text fontSize="xs" fontWeight="500" color="#00ff00">
              Anon
            </Text>
          ) : (
            <Text fontSize="xs" fontWeight="500" color="#ff0000">
              Not Anon
            </Text>
          )}
        </Box>

        <Flex gap={2}>
          <Button size="sm" onClick={onOpen} colorScheme="">
            <FiSettings color={menuTextColor} />
          </Button>

          <Button size="sm" onClick={onSettingsOpen} colorScheme="">
            <MdSecurity color={menuTextColor} />
          </Button>

          {expanded ? (
            <Button size="sm" onClick={handleMinimizeClick} colorScheme="">
              <SlArrowLeft color={menuTextColor} />
            </Button>
          ) : (
            <Button size="sm" onClick={handleExpandClick} colorScheme="">
              <SlArrowRight color={menuTextColor} />
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Drawer for Real IP and Proxy Port */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent
          style={{
            background: "rgba(24, 24, 27, 0.50",
            boxShadow: "0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset",
            backdropFilter: "blur(4px)",
          }}
        >
          <DrawerCloseButton />
          <DrawerHeader>Settings Info</DrawerHeader>
          <DrawerBody
            bg={"rgba(24, 24, 27, 0.90"}
            boxShadow={"0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset"}
          >
            <Flex
              mb={2}
              justifyContent={"space-between"}
              alignItems={"center"}
              position={"relative"}
              marginBottom="5px"
            >
              <Box
                position="absolute"
                bottom={0}
                left={0}
                width="100%"
                height="1px"
                background="linear-gradient(to right, rgba(22, 81, 103, 0), rgba(22, 81, 103, 0.8), rgba(22, 81, 103, 0))"
              />
              <Text
                fontWeight="400"
                fontSize="14px"
                color={headerBgColor}
                mb={2}
              >
                Real IP:
              </Text>
              <Text fontSize="sm">{realIP}</Text>
            </Flex>
            <SettingsComponent headerBgColor={headerBgColor} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* New Settings Drawer */}
      <Drawer isOpen={isSettingsOpen} placement="right" onClose={onSettingsClose} size="md">
        <DrawerOverlay />
        <DrawerContent
          style={{
            background: "rgba(24, 24, 27, 0.50)",
            boxShadow: "0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset",
            backdropFilter: "blur(4px)",
          }}
        >
          <DrawerCloseButton />
          <DrawerHeader>Rules Settings</DrawerHeader>
          <DrawerBody
            bg={"rgba(24, 24, 27, 0.90"}
            boxShadow={"0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset"}
          >
            <VStack spacing={4} align="stretch">
              <Button
                variant="outline"
                borderColor={headerBgColor}
                bg="transparent"
                color={headerBgColor}
                _hover={{ 
                  color: "white",
                  boxShadow: `0 0 10px ${headerBgColor}, 0 0 10px ${headerBgColor}, 0 0 10px ${headerBgColor}`
                }}
                _disabled={{
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  borderColor: 'gray.500',
                  color: 'gray.500'
                }}
                size="md"
                onClick={onAddRuleOpen}
                disabled={proxyRunning}
                leftIcon={<MdAdd />}
              >
                Add New Rule
              </Button>
              
              {proxyRunning && (
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Rules are disabled while proxy is running.
                </Text>
              )}

              {proxyRules.length > 0 && (
                <Flex justify="space-between" align="center" px={1}>
                  <Text fontSize="sm" color="gray.400">All Rules</Text>
                  <HStack spacing={2}>
                    <Text fontSize="xs" color="gray.500">
                      {proxyRules.every(r => r.enabled === false) ? 'All disabled' : proxyRules.every(r => r.enabled !== false) ? 'All enabled' : 'Mixed'}
                    </Text>
                    <Switch
                      size="sm"
                      colorScheme="green"
                      isChecked={proxyRules.some(r => r.enabled !== false)}
                      onChange={(e) => handleToggleAllProxyRules(e.target.checked)}
                    />
                  </HStack>
                </Flex>
              )}

              {proxyRules.map((rule) => (
                <RuleBox
                  key={rule.id}
                  rule={rule}
                  headerBgColor={headerBgColor}
                  deleteProxyRule={handleDeleteProxyRule}
                  editProxyRule={handleEditRule}
                  toggleProxyRule={handleToggleProxyRule}
                  proxyRunning={proxyRunning}
                />
              ))}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <NewRuleBox
        isOpen={isAddRuleOpen}
        onClose={() => {
          onAddRuleClose();
          editingRuleRef.current = null;
        }}
        headerBgColor={headerBgColor}
        onAddRule={handleAddRule}
        onEditRule={handleUpdateRule}
        currentRule={editingRuleRef.current}
      />
    </>
  );
};

export default IPCard;
