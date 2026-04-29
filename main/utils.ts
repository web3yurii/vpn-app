// src/main/utils.ts
import { Notification, nativeImage } from "electron";
import fs from "fs";
import path from "path";
import { Socks } from "@anyone-protocol/anyone-client";
import { state } from "./state";

export function showNotification(title: string, body: string) {
  new Notification({ title, body }).show();
}


export interface FingerPrintData {
  hexID: string;
  coordinates: {longitude: number, latitude: number};
}

/**
 * Fetch relay fingerprint → coordinates mapping from the Anyone API.
 * Pass a Socks client to route through the proxy (useful when the API is blocked
 * by firewalls/ISPs). Falls back gracefully — globe visualization simply
 * shows no coordinates when unavailable.
 */
export async function getFingerPrintData(socksClient?: Socks): Promise<Map<string, FingerPrintData> | null> {
  const url = "https://api.ec.anyone.tech/fingerprint-map";
  let lastError: any = null;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let json: any;

      if (socksClient) {
        const response = await socksClient.get(url);
        json = response.data;
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          const err = new Error(`${response.status} ${response.statusText}`);
          // 4xx means the endpoint is gone — no point retrying
          if (response.status >= 400 && response.status < 500) {
            console.warn(`Fingerprint fetch failed: ${err.message}`);
            throw err;
          }
          console.warn(`Attempt ${attempt}: fingerprint fetch failed: ${err.message}`);
          lastError = err;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        json = await response.json();
      }

      const fingerprintMap = new Map<string, FingerPrintData>();
      for (const [key, value] of Object.entries(json)) {
        const hexID = (value as any).hexId;
        const coordinatesArray = (value as any).coordinates;
        if (Array.isArray(coordinatesArray) && coordinatesArray.length === 2) {
          const coordinates = {
            latitude: coordinatesArray[0],
            longitude: coordinatesArray[1],
          };
          fingerprintMap.set(key, { hexID, coordinates });
        }
      }
      return fingerprintMap;
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      const msg = error?.message ?? String(error);
      // 4xx from Axios (socksClient path) — no point retrying
      if (status >= 400 && status < 500) {
        console.warn(`Fingerprint fetch failed: ${msg}`);
        throw error;
      }
      console.warn(`Attempt ${attempt}: fingerprint fetch failed: ${msg}`);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

export async function checkIP(useProxy: boolean): Promise<string | null> {
  const url = "https://api.ipify.org?format=json";
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (useProxy) {
        try {
          const response = await state.anonSocksClient.get(url);
          if (response.data && response.data.ip) {
            return response.data.ip;
          }
        } catch (error: any) {
          console.error(`Attempt ${attempt}: IP check via proxy failed:`, error.message);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          return null;
        }
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Attempt ${attempt}: IP fetch failed: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        if (data?.ip) {
          return data.ip;
        }
      }
    } catch (error: any) {
      console.error(`Attempt ${attempt}: IP check error:`, error.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        return null;
      }
    }
  }

  return null;
}

export async function getGeolocation(ip: string) {
  try {
    // First, try fetching from ipwhois.io
    const response = await fetch(`https://ipwhois.app/json/${ip}`);
    if (!response.ok) throw new Error("ipwhois.app failed");

    const data = await response.json();
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      region: data.region,
      country: data.country,
      countryCode: data.country_code,
    };
  } catch (error) {
    console.error("Primary API (ipwhois.app) failed:", error);

    // Fallback to ipapi.co if the primary API fails
    try {
      const fallbackResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      if (!fallbackResponse.ok) throw new Error("ipapi.co failed");

      const fallbackData = await fallbackResponse.json();
      return {
        latitude: fallbackData.latitude,
        longitude: fallbackData.longitude,
        city: fallbackData.city,
        region: fallbackData.region,
        country: fallbackData.country_name,
        countryCode: fallbackData.country,
      };
    } catch (fallbackError) {
      console.error("Fallback API (ipapi.co) failed:", fallbackError);
      return null;
    }
  }
}


export async function getIcon(iconPath: string) {
  try {
    const imageBuffer = fs.readFileSync(iconPath);
    const base64Data = nativeImage.createFromBuffer(imageBuffer).toDataURL();
    return base64Data;
  } catch (error) {
    console.error(`Error loading icon from ${iconPath}:`, error);
    return null;
  }
}
