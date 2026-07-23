import "server-only";

import { randomUUID } from "node:crypto";

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertCleanBuffer,
  EvidenceScanError,
} from "@/server/services/clamav-client";
import {
  buildEvidenceObjectPath,
  buildSupabaseEvidenceUri,
  EvidenceServiceError,
  resolveMaxEvidenceBytes,
  validateEvidenceBytes,
} from "@/server/services/evidence-service";

function resolveWebpQuality(): number {
  const raw = process.env.EVIDENCE_WEBP_QUALITY?.trim();
  if (!raw) return 88;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return 88;
  }
  return parsed;
}

function resolveMaxInputPixels(): number {
  const raw = process.env.EVIDENCE_MAX_INPUT_PIXELS?.trim();
  if (!raw) return 16_777_216;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 16_777_216;
  }
  return parsed;
}

async function sanitizeToWebp(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const output = await sharp(bytes, {
      limitInputPixels: resolveMaxInputPixels(),
      failOn: "warning",
      animated: false,
      pages: 1,
    })
      .rotate()
      .webp({ quality: resolveWebpQuality() })
      .toBuffer();
    return new Uint8Array(output);
  } catch {
    throw new EvidenceServiceError("transform_failed", "Image transform failed");
  }
}

export async function processAndStoreEvidence(options: {
  client: SupabaseClient;
  reportId: string;
  bytes: Uint8Array | Buffer;
  bucketName: string;
  maxBytes?: number;
  declaredContentLength?: number | null;
  declaredMimeType?: string | null;
}): Promise<{ evidenceUri: string; webpBytes: Uint8Array }> {
  const maxBytes = options.maxBytes ?? resolveMaxEvidenceBytes();
  const normalized =
    options.bytes instanceof Uint8Array
      ? options.bytes
      : new Uint8Array(options.bytes);

  const validation = await validateEvidenceBytes(normalized, {
    maxBytes,
    declaredContentLength: options.declaredContentLength,
    declaredMimeType: options.declaredMimeType,
  });
  if (!validation.ok) {
    throw new EvidenceServiceError(validation.code, "Evidence upload rejected");
  }

  try {
    await assertCleanBuffer(normalized);
  } catch (error) {
    if (error instanceof EvidenceScanError) {
      throw new EvidenceServiceError(error.code, "Evidence scan failed");
    }
    throw error;
  }

  const webpBytes = await sanitizeToWebp(normalized);
  const objectPath = buildEvidenceObjectPath(options.reportId, randomUUID());

  const { error } = await options.client.storage
    .from(options.bucketName)
    .upload(objectPath, webpBytes, {
      contentType: "image/webp",
      upsert: false,
    });

  if (error) {
    throw new EvidenceServiceError("storage_failed", "Evidence upload failed");
  }

  return {
    evidenceUri: buildSupabaseEvidenceUri(options.bucketName, objectPath),
    webpBytes,
  };
}
