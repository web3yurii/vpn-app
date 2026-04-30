import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Box, Input, Flex, Text } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import FlagIcon from "./FlagIcon";

interface CountryOption {
  code: string;
  name: string;
}

interface Props {
  value: string | null;
  onChange: (code: string | null) => void;
  options: CountryOption[];
  placeholder?: string;
  headerBgColor?: string;
  includeAny?: boolean;
}

const CountrySelect: React.FC<Props> = ({
  value,
  onChange,
  options,
  placeholder = "Select country",
  headerBgColor = "#27D7F2",
  includeAny = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value ? options.find((c) => c.code === value) ?? null : null;

  const filtered = useMemo(
    () =>
      options.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceAbove > spaceBelow;
    const maxH = Math.min(260, (openUpward ? spaceAbove : spaceBelow) - 8);

    setDropdownStyle(
      openUpward
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
            maxHeight: maxH,
          }
        : {
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
            maxHeight: maxH,
          }
    );
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      // Check if click is inside the portal dropdown
      const dropdown = document.getElementById("country-select-dropdown");
      if (dropdown?.contains(target)) return;
      setIsOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (code: string | null) => {
    onChange(code);
    setIsOpen(false);
    setSearch("");
  };

  const dropdown = isOpen
    ? ReactDOM.createPortal(
        <Box
          id="country-select-dropdown"
          style={dropdownStyle}
          bg="#18181b"
          border="1px solid"
          borderColor="gray.600"
          borderRadius="md"
          overflow="hidden"
          boxShadow="0 8px 32px rgba(0,0,0,0.6)"
          display="flex"
          flexDirection="column"
        >
          <Box p={2} borderBottom="1px solid" borderColor="gray.700" flexShrink={0}>
            <Input
              ref={inputRef}
              size="sm"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              bg="rgba(255,255,255,0.05)"
              border="1px solid"
              borderColor="gray.600"
              _focus={{ borderColor: headerBgColor, boxShadow: "none" }}
            />
          </Box>

          <Box
            overflowY="auto"
            flex={1}
            css={{
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "2px" },
            }}
          >
            {includeAny && (
              <Flex
                px={3}
                py="7px"
                align="center"
                cursor="pointer"
                bg={value === null ? "rgba(255,255,255,0.08)" : undefined}
                _hover={{ bg: "rgba(255,255,255,0.08)" }}
                onClick={() => handleSelect(null)}
              >
                <Text fontSize="sm" color="gray.400">
                  Any country
                </Text>
              </Flex>
            )}

            {filtered.map((c) => (
              <Flex
                key={c.code}
                px={3}
                py="7px"
                align="center"
                gap={2}
                cursor="pointer"
                bg={value === c.code ? "rgba(255,255,255,0.08)" : undefined}
                _hover={{ bg: "rgba(255,255,255,0.08)" }}
                onClick={() => handleSelect(c.code)}
              >
                <FlagIcon code={c.code} width={20} />
                <Text fontSize="sm" color="white">
                  {c.code.toUpperCase()} — {c.name}
                </Text>
              </Flex>
            ))}

            {filtered.length === 0 && (
              <Text fontSize="sm" color="gray.500" px={3} py={2}>
                No results
              </Text>
            )}
          </Box>
        </Box>,
        document.body
      )
    : null;

  return (
    <>
      <Flex
        ref={triggerRef}
        as="button"
        type="button"
        w="100%"
        px={3}
        py="6px"
        bg="rgba(24, 24, 27, 0.70)"
        border="1px solid"
        borderColor={isOpen ? headerBgColor : "gray.600"}
        borderRadius="md"
        align="center"
        justify="space-between"
        cursor="pointer"
        onClick={isOpen ? () => { setIsOpen(false); setSearch(""); } : openDropdown}
        _hover={{ borderColor: "gray.400" }}
        fontSize="sm"
        transition="border-color 0.15s"
      >
        <Flex align="center" gap={2} minW={0} overflow="hidden">
          {selected ? (
            <>
              <FlagIcon code={selected.code} width={20} />
              <Text fontSize="sm" color="white" noOfLines={1}>
                {selected.code.toUpperCase()} — {selected.name}
              </Text>
            </>
          ) : (
            <Text fontSize="sm" color="gray.500">
              {value === null && includeAny ? "Any country" : placeholder}
            </Text>
          )}
        </Flex>
        <ChevronDownIcon
          color="gray.400"
          flexShrink={0}
          ml={2}
          transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
          transition="transform 0.15s"
        />
      </Flex>

      {dropdown}
    </>
  );
};

export default CountrySelect;
