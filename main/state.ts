// src/main/state.ts
import { BrowserWindow, Menu, Tray } from "electron";
import {
  Process,
  Socks,
  Control,
  StateManager,
  VPNManager,
} from "@anyone-protocol/anyone-client";
import { exePath, termsFilePath } from "./constants";
import { FingerPrintData } from "./utils";
import { Menubar } from "menubar";

export interface RelayData {
  fingerprint: string;
  nickname: string;
  ip: string;
  coordinates: { longitude: number; latitude: number };
  hexId: string;
  numberOfRelays: number;
}

export interface FingerprintData {
  hexID: string;
  coordinates: { longitude: number; latitude: number };
}

// TODO: Maybe redundant, double check
export interface ProxyRuleConfig {
  routings: {
    targetAddress: string;
    hops: number;
    entryCountries: string[];
    exitCountries: string[];
  }[];
}

interface AppState {
  mainWindow: BrowserWindow | null;
  settingsWindow: BrowserWindow | null;
  tray: Menubar;
  isQuitting: boolean;
  isProxyRunning: boolean;
  isProxyStarting: boolean;
  anon: Process | null;
  anonSocksClient: Socks | null;
  anonControlClient: Control | null;
  stateManager: StateManager | null;
  vpnManager: VPNManager | null;
  proxyPort: number;
  anonPort: number;
  anonControlPort: number;
  orPort: number;
  relayIp: string | null;
  realIp: string | null;
  proxyIp: string | null;
  exePath: string;
  relayData: RelayData | null;
  proxyRuleConfig: ProxyRuleConfig | null;
  numberOfRelays: number;
  fingerprintData: Map<string, FingerprintData>;
  screenSize: { width: number; height: number };
  termsFilePath: string | null;
}

export const state: AppState = {
  mainWindow: null,
  settingsWindow: null,
  tray: null,
  isQuitting: false,
  isProxyRunning: false,
  isProxyStarting: false,
  anon: null,
  anonSocksClient: null,
  anonControlClient: null,
  stateManager: null,
  vpnManager: null,
  proxyPort: 9050, // Use the same port as the anon socks port
  anonPort: 9050,
  anonControlPort: 9051,
  orPort: 9001,
  relayIp: null,
  realIp: null,
  proxyIp: null,
  exePath: exePath,
  relayData: null,
  proxyRuleConfig: null,
  numberOfRelays: 0,
  fingerprintData: new Map(),
  screenSize: { width: 0, height: 0 },
  termsFilePath: termsFilePath,
};

export async function initializeState() {
  // Nothing to initialize at startup
}
