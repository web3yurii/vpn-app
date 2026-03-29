import {
  Box,
  Button,
  Flex,
  HStack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";

export interface Rule {
  id: string;
  title: string;
  destinations: string[];
  hops: number;
  entryCountries: string[];
  exitCountries: string[];
  enabled?: boolean;
}

interface RuleBoxProps {
  rule: Rule;
  headerBgColor: string;
  deleteProxyRule: (ruleId: string) => void;
  editProxyRule: (rule: Rule) => void;
  toggleProxyRule: (ruleId: string) => void;
  proxyRunning: boolean;
}

export const RuleBox: React.FC<RuleBoxProps> = ({ rule, headerBgColor, deleteProxyRule, editProxyRule, toggleProxyRule, proxyRunning }) => {
  const isEnabled = rule.enabled !== false;

  return (
    <Box
      border="1px solid"
      borderColor={isEnabled ? "gray.600" : "gray.700"}
      borderRadius="md"
      p={4}
      bg="rgba(24, 24, 27, 0.70)"
      backdropFilter="blur(4px)"
      w="100%"
      opacity={isEnabled ? 1 : 0.5}
    >
      <Flex justify="space-between" align="center" mb={3}>
        <HStack spacing={3}>
          <Switch
            size="sm"
            isChecked={isEnabled}
            onChange={() => toggleProxyRule(rule.id)}
            colorScheme="green"
          />
          <Text color={isEnabled ? headerBgColor : "gray.500"} fontWeight="500">
            {rule.title}
          </Text>
        </HStack>
        <HStack spacing={2}>
          <Button size="sm" colorScheme="blue" variant="ghost" onClick={() => editProxyRule(rule)} disabled={proxyRunning} _disabled={{
            opacity: 0.5,
            cursor: 'not-allowed',
            color: 'gray.500'
          }}>
            Edit
          </Button>
          <Button size="sm" colorScheme="red" variant="ghost" onClick={() => deleteProxyRule(rule.id)} disabled={proxyRunning} _disabled={{
            opacity: 0.5,
            cursor: 'not-allowed',
            color: 'gray.500'
          }}>
            Delete
          </Button>
        </HStack>
      </Flex>

      <VStack align="stretch" spacing={2}>
        <Box>
          <Text fontSize="xs" color="gray.400">Destinations:</Text>
          <Text fontSize="sm" color="white">{rule.destinations.join(', ')}</Text>
        </Box>

        <Box>
          <Text fontSize="xs" color="gray.400">Hops:</Text>
          <Text fontSize="sm" color="white">{rule.hops}</Text>
        </Box>

        {/* <Box>
          <Text fontSize="xs" color="gray.400">Entry Countries:</Text>
          <Text fontSize="sm" color="white">{rule.entryCountries.join(', ')}</Text>
        </Box> */}

        <Box>
          <Text fontSize="xs" color="gray.400">Exit Countries:</Text>
          <Text fontSize="sm" color="white">{rule.exitCountries.map(c => c.toUpperCase()).join(', ')}</Text>
        </Box>
      </VStack>
    </Box>
  );
}; 