/**
 * Citizen evidence upload input types (client + server).
 * All accepted inputs are re-encoded to WebP before storage.
 */

/** Canonical MIME types accepted after magic-byte validation. */
export const EVIDENCE_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
] as const;

export type EvidenceInputMimeType = (typeof EVIDENCE_INPUT_MIME_TYPES)[number];

export const EVIDENCE_INPUT_MIME_SET = new Set<string>(EVIDENCE_INPUT_MIME_TYPES);

/** Browser `File.type` values we accept before server validation. */
export const EVIDENCE_CLIENT_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/tif",
] as const;

export const EVIDENCE_INPUT_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

export const EVIDENCE_FILE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/tiff,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff";

export function isEvidenceInputExtension(ext: string): boolean {
  return EVIDENCE_INPUT_EXTENSIONS.has(ext.toLowerCase());
}

export function isAcceptedEvidenceClientFile(file: File): boolean {
  if (
    EVIDENCE_CLIENT_MIME_TYPES.includes(
      file.type as (typeof EVIDENCE_CLIENT_MIME_TYPES)[number],
    )
  ) {
    return true;
  }

  if (!file.type || file.type === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return isEvidenceInputExtension(ext);
  }

  return false;
}
