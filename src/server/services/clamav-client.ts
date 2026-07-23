import "server-only";

import { Readable } from "node:stream";

import NodeClam from "clamscan";

export class EvidenceScanError extends Error {
  readonly code: "infected" | "scanner_unavailable";

  constructor(code: EvidenceScanError["code"], message: string) {
    super(message);
    this.name = "EvidenceScanError";
    this.code = code;
  }
}

type ClamClient = {
  scanStream: (stream: Readable) => Promise<{ isInfected: boolean; viruses?: string[] }>;
  ping: () => Promise<unknown>;
};

let clientPromise: Promise<ClamClient> | null = null;

export function resetClamavClientForTests(): void {
  clientPromise = null;
}

export function isClamavEnabled(): boolean {
  return process.env.CLAMAV_ENABLED !== "false";
}

async function getClient(): Promise<ClamClient> {
  if (!clientPromise) {
    clientPromise = new NodeClam().init({
      removeInfected: false,
      preference: "clamdscan",
      clamdscan: {
        host: process.env.CLAMAV_HOST ?? "127.0.0.1",
        port: Number(process.env.CLAMAV_PORT ?? 3310),
        timeout: Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000),
        localFallback: false,
      },
      clamscan: { active: false },
    }) as Promise<ClamClient>;
  }
  return clientPromise;
}

export async function assertCleanBuffer(bytes: Uint8Array): Promise<void> {
  if (!isClamavEnabled()) {
    return;
  }

  try {
    const clam = await getClient();
    const stream = Readable.from(Buffer.from(bytes));
    const result = await clam.scanStream(stream);
    if (result.isInfected) {
      throw new EvidenceScanError("infected", "Malware detected");
    }
  } catch (error) {
    if (error instanceof EvidenceScanError) {
      throw error;
    }
    throw new EvidenceScanError("scanner_unavailable", "Scanner unavailable");
  }
}

export async function pingClamav(): Promise<void> {
  if (!isClamavEnabled()) {
    throw new EvidenceScanError("scanner_unavailable", "ClamAV disabled");
  }

  try {
    const clam = await getClient();
    await clam.ping();
  } catch (error) {
    if (error instanceof EvidenceScanError) {
      throw error;
    }
    throw new EvidenceScanError("scanner_unavailable", "Scanner unavailable");
  }
}
