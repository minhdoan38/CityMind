import "server-only";

import { fileTypeFromBuffer } from "file-type";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type EvidenceValidationErrorCode =
  | "empty"
  | "oversized"
  | "invalid_type"
  | "spoofed_mime";

export type EvidenceValidationResult =
  | { ok: true; mimeType: string; ext: string }
  | { ok: false; code: EvidenceValidationErrorCode };

export class EvidenceServiceError extends Error {
  readonly code: EvidenceValidationErrorCode | "storage_failed" | "invalid_uri";

  constructor(code: EvidenceServiceError["code"], message: string) {
    super(message);
    this.name = "EvidenceServiceError";
    this.code = code;
  }
}

export function resolveMaxEvidenceBytes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.MAX_IMAGE_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_EVIDENCE_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_EVIDENCE_BYTES;
  }
  return parsed;
}

export function buildEvidenceObjectPath(reportId: string, ext: string): string {
  return `reports/${reportId}/evidence.${ext}`;
}

export function buildSupabaseEvidenceUri(bucket: string, objectPath: string): string {
  return `supabase://${bucket}/${objectPath}`;
}

export function formatEvidencePath(bucket: string, objectPath: string): string {
  return `${bucket}/${objectPath}`;
}

export type EvidenceStorageLocation = {
  bucket: string;
  objectPath: string;
};

export function parseEvidencePath(path: string): EvidenceStorageLocation {
  const slashIndex = path.indexOf("/");
  if (slashIndex <= 0 || slashIndex === path.length - 1) {
    throw new EvidenceServiceError("invalid_uri", "Malformed evidence path");
  }
  return {
    bucket: path.slice(0, slashIndex),
    objectPath: path.slice(slashIndex + 1),
  };
}

export function resolveEvidenceLocation(options: {
  evidencePath?: string | null;
  legacyUri?: string | null;
}): EvidenceStorageLocation | null {
  if (options.evidencePath?.trim()) {
    return parseEvidencePath(options.evidencePath.trim());
  }
  if (options.legacyUri?.startsWith("supabase://")) {
    return parseSupabaseEvidenceUri(options.legacyUri);
  }
  return null;
}

export function parseSupabaseEvidenceUri(uri: string): {
  bucket: string;
  objectPath: string;
} {
  if (!uri.startsWith("supabase://")) {
    throw new EvidenceServiceError("invalid_uri", "Unsupported evidence URI");
  }
  const remainder = uri.slice("supabase://".length);
  const slashIndex = remainder.indexOf("/");
  if (slashIndex <= 0 || slashIndex === remainder.length - 1) {
    throw new EvidenceServiceError("invalid_uri", "Malformed evidence URI");
  }
  return {
    bucket: remainder.slice(0, slashIndex),
    objectPath: remainder.slice(slashIndex + 1),
  };
}

function toUint8Array(bytes: Uint8Array | Buffer): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

export async function validateEvidenceBytes(
  bytes: Uint8Array | Buffer | null | undefined,
  options: {
    maxBytes: number;
    declaredContentLength?: number | null;
    declaredMimeType?: string | null;
  },
): Promise<EvidenceValidationResult> {
  if (
    options.declaredContentLength != null &&
    options.declaredContentLength > options.maxBytes
  ) {
    return { ok: false, code: "oversized" };
  }

  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, code: "empty" };
  }

  const normalized = toUint8Array(bytes);
  if (normalized.byteLength > options.maxBytes) {
    return { ok: false, code: "oversized" };
  }

  const detected = await fileTypeFromBuffer(normalized);
  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
    return { ok: false, code: "invalid_type" };
  }

  const ext = MIME_TO_EXT[detected.mime];
  if (!ext) {
    return { ok: false, code: "invalid_type" };
  }

  if (
    options.declaredMimeType &&
    options.declaredMimeType !== detected.mime
  ) {
    return { ok: false, code: "spoofed_mime" };
  }

  return { ok: true, mimeType: detected.mime, ext };
}

export async function uploadEvidence(options: {
  client: SupabaseClient;
  reportId: string;
  bytes: Uint8Array | Buffer;
  bucketName: string;
  maxBytes?: number;
  declaredContentLength?: number | null;
  declaredMimeType?: string | null;
}): Promise<string> {
  const maxBytes = options.maxBytes ?? resolveMaxEvidenceBytes();
  const validation = await validateEvidenceBytes(options.bytes, {
    maxBytes,
    declaredContentLength: options.declaredContentLength,
    declaredMimeType: options.declaredMimeType,
  });
  if (!validation.ok) {
    throw new EvidenceServiceError(validation.code, "Evidence upload rejected");
  }

  const objectPath = buildEvidenceObjectPath(options.reportId, validation.ext);
  const normalized = toUint8Array(options.bytes);
  const { error } = await options.client.storage
    .from(options.bucketName)
    .upload(objectPath, normalized, {
      contentType: validation.mimeType,
      upsert: false,
    });

  if (error) {
    throw new EvidenceServiceError("storage_failed", "Evidence upload failed");
  }

  return buildSupabaseEvidenceUri(options.bucketName, objectPath);
}

export async function deleteEvidenceObject(options: {
  client: SupabaseClient;
  bucketName: string;
  objectPath: string;
}): Promise<void> {
  const { error } = await options.client.storage
    .from(options.bucketName)
    .remove([options.objectPath]);
  if (error) {
    throw new EvidenceServiceError("storage_failed", "Evidence delete failed");
  }
}

export async function deleteEvidenceByUri(options: {
  client: SupabaseClient;
  uri: string;
}): Promise<void> {
  const { bucket, objectPath } = parseSupabaseEvidenceUri(options.uri);
  await deleteEvidenceObject({
    client: options.client,
    bucketName: bucket,
    objectPath,
  });
}

export async function downloadEvidenceByUri(options: {
  client: SupabaseClient;
  uri: string;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { bucket, objectPath } = parseSupabaseEvidenceUri(options.uri);
  return downloadEvidenceObject({
    client: options.client,
    bucket,
    objectPath,
  });
}

export async function downloadEvidenceObject(options: {
  client: SupabaseClient;
  bucket: string;
  objectPath: string;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { data, error } = await options.client.storage
    .from(options.bucket)
    .download(options.objectPath);

  if (error || !data) {
    throw new EvidenceServiceError("storage_failed", "Evidence download failed");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const ext = options.objectPath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EXT_TO_MIME[ext] ?? "application/octet-stream";
  return { bytes, mimeType };
}

export async function downloadEvidenceLocation(options: {
  client: SupabaseClient;
  evidencePath?: string | null;
  legacyUri?: string | null;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const location = resolveEvidenceLocation({
    evidencePath: options.evidencePath,
    legacyUri: options.legacyUri,
  });
  if (!location) {
    throw new EvidenceServiceError("invalid_uri", "Unsupported evidence URI");
  }
  return downloadEvidenceObject({
    client: options.client,
    bucket: location.bucket,
    objectPath: location.objectPath,
  });
}
