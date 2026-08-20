import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "doctor-certificates";
// Vercel enforces a hard, infrastructure-level 4.5MB request body limit on serverless functions
// (Server Actions included) — it cannot be raised via config and overrides next.config.ts's
// bodySizeLimit once deployed there. 4MB leaves headroom for multipart/form-data overhead and the
// other form fields. If the upload path ever moves to direct-to-Supabase-Storage (bypassing the
// Server Action, and therefore this platform limit), this cap can be raised again.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export class CertificateUploadError extends Error {}

export function buildCertificatePath(mimeType: string): string {
  const ext = ALLOWED_MIME_TO_EXT[mimeType];
  if (!ext) {
    throw new CertificateUploadError(
      `Unsupported file type "${mimeType}". Allowed: PDF, JPEG, PNG.`,
    );
  }
  // Random token, not the doctor's name/reg-number, and not doctors.id (that row doesn't exist
  // yet at upload time) — matches the DPDP-by-default principle already stated in the RLS
  // migration header.
  return `${randomUUID()}/certificate.${ext}`;
}

/**
 * Impure: uploads to Supabase Storage. Takes the admin client as a parameter, same pattern as
 * lib/ingestion/insert.ts, so the validation logic (path/MIME/size) is separable and mockable.
 */
export async function uploadCertificate(
  admin: SupabaseClient,
  file: File,
): Promise<{ path: string }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new CertificateUploadError(
      `File is ${(file.size / 1024 / 1024).toFixed(1)}MB, which exceeds the 10MB limit.`,
    );
  }

  const path = buildCertificatePath(file.type);

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });

  if (error) {
    throw new CertificateUploadError(`Failed to upload certificate: ${error.message}`);
  }

  return { path };
}

export async function deleteCertificate(admin: SupabaseClient, path: string): Promise<void> {
  // Best-effort cleanup (e.g. after a duplicate-submission rollback) — a failure here shouldn't
  // mask the original error that triggered the cleanup.
  await admin.storage.from(BUCKET).remove([path]);
}

export async function getCertificateSignedUrl(
  admin: SupabaseClient,
  path: string,
  expiresInSeconds: number,
): Promise<string> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new CertificateUploadError(
      `Failed to create signed URL: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.signedUrl;
}
