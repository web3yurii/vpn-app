import { Control } from "@anyone-protocol/anyone-client";

export async function findMatchingCircuitGivenExitIP(
  circuit: any,
  controlClient: Control,
  ip: string
) {
  if (circuit.relays && circuit.relays.length > 0) {
    const lastRelay = circuit.relays[circuit.relays.length - 1];
    const lastFingerprint = lastRelay.fingerprint;

    try {
      const relayInfo = await controlClient.getRelayInfo(lastFingerprint);
      if (relayInfo.ip === ip) {
        console.log(relayInfo);
        return circuit.circuitId;
      }
    } catch (error) {
      console.error(
        `Error getting IP for circuit ${circuit.circuitId}:`,
        error.message
      );
    }
  }
}
