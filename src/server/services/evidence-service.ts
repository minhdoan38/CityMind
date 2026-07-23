import "server-only";

import { randomUUID } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_MAX_EVIDENCE_BYTES,
  resolveMaxEvidenceBytesFromEnv,
} from "@/lib/evidence-limits";
import { EVIDENCE_INPUT_MIME_SET } from "@/lib/evidence-input-types";

export { DEFAULT_MAX_EVIDENCE_BYTES };

/** Input MIME types accepted before WebP re-encode (see evidence-input-types). */
export const ALLOWED_IMAGE_MIME_TYPES = EVIDENCE_INPUT_MIME_SET;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/tiff": "tiff",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

const DECLARED_MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/tif": "image/tiff",
};

function normalizeDeclaredMimeType(
  mime: string | null | undefined,
): string | null {
  if (!mime) return null;
  const trimmed = mime.trim().toLowerCase();
  if (!trimmed) return null;
  return DECLARED_MIME_ALIASES[trimmed] ?? trimmed;
}

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  const heifMime = sniffHeifMime(bytes);
  if (heifMime) {
    return heifMime;
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "image/tiff";
  }
  return null;
}

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);

function readIsoBrand(bytes: Uint8Array, offset: number): string | null {
  if (offset + 4 > bytes.length) return null;
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function sniffHeifMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (readIsoBrand(bytes, 4) !== "ftyp") return null;

  const majorBrand = readIsoBrand(bytes, 8);
  if (majorBrand && HEIF_BRANDS.has(majorBrand)) {
    return majorBrand === "mif1" || majorBrand === "msf1" ? "image/heif" : "image/heic";
  }

  for (let offset = 16; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
    const brand = readIsoBrand(bytes, offset);
    if (brand && HEIF_BRANDS.has(brand)) {
      return brand === "mif1" || brand === "msf1" ? "image/heif" : "image/heic";
    }
  }

  return null;
}

const REJECTED_IMAGE_MIME_TYPES = new Set(["image/gif", "image/svg+xml"]);

function isRejectedImageMime(mime: string | undefined | null): boolean {
  return Boolean(mime && REJECTED_IMAGE_MIME_TYPES.has(mime));
}

function sniffRejectedImageMime(bytes: Uint8Array): boolean {
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return true;
  }
  const prefix = new TextDecoder()
    .decode(bytes.slice(0, Math.min(bytes.length, 256)))
    .trimStart()
    .toLowerCase();
  return prefix.startsWith("<svg") || prefix.startsWith("<?xml");
}

async function detectImageMime(bytes: Uint8Array): Promise<string | null> {
  const detected = await fileTypeFromBuffer(bytes);
  if (isRejectedImageMime(detected?.mime) || sniffRejectedImageMime(bytes)) {
    return null;
  }
  if (detected?.mime === "image/heif") {
    return "image/heif";
  }
  if (detected?.mime === "image/heic") {
    return "image/heic";
  }
  if (detected?.mime && ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
    return detected.mime;
  }
  return sniffImageMime(bytes);
}

export type EvidenceValidationErrorCode =
  | "empty"
  | "oversized"
  | "invalid_type"
  | "spoofed_mime";

export type EvidenceValidationResult =
  | { ok: true; mimeType: string; ext: string }
  | { ok: false; code: EvidenceValidationErrorCode };

export class EvidenceServiceError extends Error {
  readonly code:
    | EvidenceValidationErrorCode
    | "storage_failed"
    | "invalid_uri"
    | "infected"
    | "scanner_unavailable"
    | "transform_failed";

  constructor(code: EvidenceServiceError["code"], message: string) {
    super(message);
    this.name = "EvidenceServiceError";
    this.code = code;
  }
}

export function resolveMaxEvidenceBytes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return resolveMaxEvidenceBytesFromEnv(env);
}

/** Legacy upload helper; prefer processAndStoreEvidence for new evidence paths. */
export function buildEvidenceObjectPath(
  reportId: string,
  objectId?: string,
): string {
  return `reports/${reportId}/${objectId ?? randomUUID()}.webp`;
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

  const detectedMime = await detectImageMime(normalized);
  if (!detectedMime) {
    return { ok: false, code: "invalid_type" };
  }

  const ext = MIME_TO_EXT[detectedMime];
  if (!ext) {
    return { ok: false, code: "invalid_type" };
  }

  const normalizedDeclared = normalizeDeclaredMimeType(options.declaredMimeType);
  if (
    normalizedDeclared &&
    ALLOWED_IMAGE_MIME_TYPES.has(normalizedDeclared) &&
    normalizedDeclared !== detectedMime &&
    !areCompatibleEvidenceMimes(normalizedDeclared, detectedMime)
  ) {
    return { ok: false, code: "spoofed_mime" };
  }

  return { ok: true, mimeType: detectedMime, ext };
}

function areCompatibleEvidenceMimes(declared: string, detected: string): boolean {
  if (declared === detected) return true;
  if (
    (declared === "image/heic" && detected === "image/heif") ||
    (declared === "image/heif" && detected === "image/heic")
  ) {
    return true;
  }
  return false;
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

  const objectPath = buildEvidenceObjectPath(options.reportId);
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
