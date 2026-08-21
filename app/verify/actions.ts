"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOtp, checkAndConsumeOtp, OtpRateLimitError, OtpVerificationError } from "@/lib/doctors/otp";
import { sendOtpEmail, OtpEmailSendError } from "@/lib/email/send-otp";
import {
  createDoctorAccount,
  InvalidSubmissionError,
  OtpNotVerifiedError,
  AccountExistsError,
  DuplicateSubmissionError,
} from "@/lib/doctors/submit";

export interface VerifyFormState {
  phase: "details" | "otp_sent" | "otp_verified";
  error?: string;
  email?: string;
  otpVerificationId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/**
 * Single Server Action, dispatched on a hidden `intent` field, matching the three sub-steps of
 * page 1: send-otp -> verify-otp -> submit (create account, sign in, redirect to page 2).
 * Server-side re-validates at every step regardless of what the UI's disabled/hidden state
 * gated — that's a UX nicety, not the security boundary.
 */
export async function verifyFormAction(
  prevState: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const intent = String(formData.get("intent") ?? "");
  const admin = createAdminClient();

  if (intent === "send-otp") {
    const email = String(formData.get("contactEmail") ?? "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      return { ...prevState, error: "Enter a valid email address first." };
    }

    try {
      const ip = await clientIp();
      const otp = await createOtp(admin, email, ip);
      await sendOtpEmail(email, otp);
    } catch (err) {
      const known = err instanceof OtpRateLimitError || err instanceof OtpEmailSendError;
      if (!known) console.error("[verify] send-otp failed:", err);
      return {
        ...prevState,
        error: known ? (err as Error).message : "Failed to send verification code. Please try again.",
      };
    }

    return { phase: "otp_sent", email };
  }

  if (intent === "verify-otp") {
    const email = String(formData.get("contactEmail") ?? prevState.email ?? "").trim();
    const code = String(formData.get("otpCode") ?? "").trim();

    try {
      const { otpVerificationId } = await checkAndConsumeOtp(admin, email, code);
      return { phase: "otp_verified", email, otpVerificationId };
    } catch (err) {
      const known = err instanceof OtpVerificationError;
      if (!known) console.error("[verify] verify-otp failed:", err);
      return {
        ...prevState,
        error: known ? (err as Error).message : "Verification failed. Please try again.",
      };
    }
  }

  if (intent === "submit") {
    const email = String(formData.get("contactEmail") ?? "").trim();
    const otpVerificationId = String(formData.get("otpVerificationId") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!otpVerificationId) {
      return { ...prevState, error: "Please verify your email first." };
    }

    const input = {
      name: String(formData.get("name") ?? ""),
      registrationCouncil: String(formData.get("registrationCouncil") ?? ""),
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      contactEmail: email,
      password,
    };

    try {
      await createDoctorAccount(admin, input, otpVerificationId);
    } catch (err) {
      if (err instanceof InvalidSubmissionError) {
        return { ...prevState, error: err.errors.join(" ") };
      }
      if (
        err instanceof OtpNotVerifiedError ||
        err instanceof AccountExistsError ||
        err instanceof DuplicateSubmissionError
      ) {
        return { ...prevState, error: err.message };
      }
      console.error("[verify] submit failed:", err);
      return { ...prevState, error: "Something went wrong. Please try again." };
    }

    // Sign the doctor in (sets real session cookies via the anon-key server client) so page 2
    // (an authenticated route) works immediately, and so they can resume there later if they
    // drop off before uploading a certificate.
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.error("[verify] sign-in after account creation failed:", signInError);
      return {
        ...prevState,
        error: "Account created, but automatic sign-in failed. Please log in manually.",
      };
    }

    redirect("/verify/certificate");
  }

  return prevState;
}
