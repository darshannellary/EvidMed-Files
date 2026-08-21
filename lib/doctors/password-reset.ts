import type { SupabaseClient } from "@supabase/supabase-js";
import { createOtp, checkAndConsumeOtp } from "./otp";
import { sendPasswordResetOtpEmail } from "@/lib/email/send-password-reset-otp";

/**
 * Silently no-ops for a non-matching email or a doctor who never finished signup (no user_id
 * yet) — the caller always shows the same "code sent" UI regardless, so this never leaks whether
 * an email is registered.
 */
export async function requestPasswordReset(
  admin: SupabaseClient,
  email: string,
  ipAddress: string | null,
): Promise<void> {
  const { data: doctor, error } = await admin
    .from("doctors")
    .select("user_id")
    .eq("contact_email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up doctor: ${error.message}`);
  }
  if (!doctor || !doctor.user_id) {
    return;
  }

  const otp = await createOtp(admin, email, ipAddress);
  await sendPasswordResetOtpEmail(email, otp);
}

export async function resetPassword(
  admin: SupabaseClient,
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  // Throws OtpVerificationError on a bad/expired/missing code — a valid OTP for this email can
  // only exist if requestPasswordReset found a matching doctor, so the lookup below is
  // defensive, not the primary guard.
  await checkAndConsumeOtp(admin, email, code);

  const { data: doctor, error } = await admin
    .from("doctors")
    .select("user_id")
    .eq("contact_email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up doctor: ${error.message}`);
  }
  if (!doctor || !doctor.user_id) {
    throw new Error(`No account found for ${email} despite a valid OTP.`);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(doctor.user_id as string, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error(`Failed to update password: ${updateError.message}`);
  }
}
