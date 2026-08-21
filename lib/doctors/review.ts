import type { SupabaseClient } from "@supabase/supabase-js";
import type { PendingDoctor } from "./types";
import { getCertificateSignedUrl } from "./storage";
import { sendApprovalEmail, ApprovalEmailSendError } from "@/lib/email/send-approval";

export interface ApproveDoctorResult {
  emailSent: boolean;
  emailError?: string;
}

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

export async function approveDoctor(admin: SupabaseClient, id: string): Promise<ApproveDoctorResult> {
  const { data, error } = await admin
    .from("doctors")
    .update({ verification_status: "verified", verification_method: "manual" })
    .eq("id", id)
    .select("name, contact_email")
    .single();

  if (error) {
    throw new Error(`Failed to approve doctor ${id}: ${error.message}`);
  }

  const { name, contact_email: contactEmail } = data as { name: string; contact_email: string | null };

  if (!contactEmail) {
    return { emailSent: false, emailError: "no contact email on file" };
  }

  // The doctor is already approved in the DB by this point — an email failure here is a
  // best-effort notification failing, not a reason to fail the approval itself.
  try {
    await sendApprovalEmail(contactEmail, name);
    return { emailSent: true };
  } catch (err) {
    const message = err instanceof ApprovalEmailSendError ? err.message : "unknown error";
    return { emailSent: false, emailError: message };
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
