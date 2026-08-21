import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingDoctor } from "./types";
import { getCertificateSignedUrl } from "./storage";

export async function listPendingDoctors(admin: SupabaseClient): Promise<PendingDoctor[]> {
  const { data, error } = await admin
    .from("doctors")
    .select("id, name, registration_council, registration_number, contact_phone, contact_email, created_at")
    .eq("verification_status", "pending")
    // Excludes in-progress signups that completed page 1 (account created) but haven't reached
    // page 2 (certificate upload) yet — not ready for review, still mid-signup.
    .not("certificate_path", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list pending doctors: ${error.message}`);
  }

  return (data ?? []) as PendingDoctor[];
}

export async function approveDoctor(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from("doctors")
    .update({ verification_status: "verified", verification_method: "manual" })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to approve doctor ${id}: ${error.message}`);
  }
}

export async function rejectDoctor(
  admin: SupabaseClient,
  id: string,
  reason?: string,
): Promise<void> {
  const { error } = await admin
    .from("doctors")
    .update({
      verification_status: "rejected",
      verification_method: "manual",
      rejection_reason: reason ?? null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to reject doctor ${id}: ${error.message}`);
  }
}

export async function getDoctorCertificateSignedUrl(
  admin: SupabaseClient,
  id: string,
  expiresInSeconds: number,
): Promise<string> {
  const { data, error } = await admin
    .from("doctors")
    .select("certificate_path")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Failed to look up doctor ${id}: ${error.message}`);
  }
  if (!data.certificate_path) {
    throw new Error(`Doctor ${id} has no certificate on file.`);
  }

  return getCertificateSignedUrl(admin, data.certificate_path as string, expiresInSeconds);
}
