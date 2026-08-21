"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { OtpRateLimitError, OtpVerificationError } from "@/lib/doctors/otp";
import { PasswordResetEmailSendError } from "@/lib/email/send-password-reset-otp";
import { requestPasswordReset, resetPassword } from "@/lib/doctors/password-reset";

export interface ForgotPasswordFormState {
  phase: "request" | "code_sent";
  error?: string;
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/**
 * Single Server Action, dispatched on a hidden `intent` field, matching the two sub-steps:
 * request-code -> reset-password (code + new password submitted together, since there's no other
 * profile data to collect here unlike signup's three-step flow).
 */
export async function forgotPasswordAction(
  prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const intent = String(formData.get("intent") ?? "");
  const admin = createAdminClient();

  if (intent === "request-code") {
    const email = String(formData.get("email") ?? "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      return { ...prevState, error: "Enter a valid email address first." };
    }

    try {
      const ip = await clientIp();
      await requestPasswordReset(admin, email, ip);
    } catch (err) {
      const known = err instanceof OtpRateLimitError || err instanceof PasswordResetEmailSendError;
      if (!known) console.error("[forgot-password] request-code failed:", err);
      return {
        ...prevState,
        error: known ? (err as Error).message : "Something went wrong. Please try again.",
      };
    }

    // Same state regardless of whether a matching account was found, so this step never leaks
    // whether an email is registered.
    return { phase: "code_sent", email };
  }

  if (intent === "reset-password") {
    const email = String(formData.get("email") ?? prevState.email ?? "").trim();
    const code = String(formData.get("otpCode") ?? "").trim();
    const newPassword = String(formData.get("newPassword") ?? "");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { ...prevState, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    try {
      await resetPassword(admin, email, code, newPassword);
    } catch (err) {
      const known = err instanceof OtpVerificationError;
      if (!known) console.error("[forgot-password] reset-password failed:", err);
      return {
        ...prevState,
        error: known ? (err as Error).message : "Something went wrong. Please try again.",
      };
    }

    redirect("/login");
  }

  return prevState;
}
