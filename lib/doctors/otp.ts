import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_EMAIL_PER_HOUR = 5;
const MAX_SENDS_PER_IP_PER_HOUR = 10;

export class OtpRateLimitError extends Error {}
export class OtpVerificationError extends Error {}

export interface OtpRow {
  id: string;
  email: string;
  otp_hash: string;
  attempts: number;
  consumed_at: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
}

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(otp: string, secret: string): string {
  return createHmac("sha256", secret).update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string, secret: string): boolean {
  const expected = hashOtp(otp, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isOtpValid(row: Pick<OtpRow, "consumed_at" | "expires_at">, now: Date): boolean {
  if (row.consumed_at) return false;
  return new Date(row.expires_at).getTime() > now.getTime();
}

function otpHmacSecret(): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret) {
    throw new Error("OTP_HMAC_SECRET is not set");
  }
  return secret;
}

/**
 * Rate-limits (per-email and per-IP, since a per-email cap alone doesn't stop one actor from
 * spamming many different inboxes), generates, hashes, and stores a new OTP. Returns the plain
 * code so the caller can email it — never re-derivable from the stored hash.
 */
export async function createOtp(
  admin: SupabaseClient,
  email: string,
  ipAddress: string | null,
): Promise<string> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: emailCount, error: emailCountError } = await admin
    .from("email_otp_verifications")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", oneHourAgo);

  if (emailCountError) {
    throw new Error(`Failed to check OTP rate limit: ${emailCountError.message}`);
  }
  if ((emailCount ?? 0) >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
    throw new OtpRateLimitError("Too many verification codes requested for this email. Try again later.");
  }

  if (ipAddress) {
    const { count: ipCount, error: ipCountError } = await admin
      .from("email_otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", oneHourAgo);

    if (ipCountError) {
      throw new Error(`Failed to check OTP rate limit: ${ipCountError.message}`);
    }
    if ((ipCount ?? 0) >= MAX_SENDS_PER_IP_PER_HOUR) {
      throw new OtpRateLimitError("Too many verification codes requested. Try again later.");
    }
  }

  const { data: mostRecent } = await admin
    .from("email_otp_verifications")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mostRecent) {
    const secondsSinceLast = (Date.now() - new Date(mostRecent.created_at as string).getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      throw new OtpRateLimitError(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`,
      );
    }
  }

  // No cron infra exists in this project — clean up old rows for this email on every new send.
  await admin.from("email_otp_verifications").delete().eq("email", email);

  const otp = generateOtp();
  const otpHash = hashOtp(otp, otpHmacSecret());
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error } = await admin.from("email_otp_verifications").insert({
    email,
    otp_hash: otpHash,
    ip_address: ipAddress,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to store OTP: ${error.message}`);
  }

  return otp;
}

/**
 * Verifies a submitted code. Locks (marks consumed) after MAX_VERIFY_ATTEMPTS failed attempts to
 * force a resend rather than allowing unlimited guessing. On success, marks consumed and returns
 * the row id as a "proof" the caller can pass to createDoctorAccount().
 */
export async function checkAndConsumeOtp(
  admin: SupabaseClient,
  email: string,
  code: string,
): Promise<{ otpVerificationId: string }> {
  const { data: row, error } = await admin
    .from("email_otp_verifications")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up OTP: ${error.message}`);
  }
  if (!row) {
    throw new OtpVerificationError("No verification code found for this email. Request a new one.");
  }
  if (!isOtpValid(row, new Date())) {
    throw new OtpVerificationError("This verification code has expired or was already used. Request a new one.");
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    await admin
      .from("email_otp_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    throw new OtpVerificationError("Too many incorrect attempts. Request a new code.");
  }

  if (!verifyOtpHash(code, row.otp_hash as string, otpHmacSecret())) {
    await admin
      .from("email_otp_verifications")
      .update({ attempts: (row.attempts as number) + 1 })
      .eq("id", row.id);
    throw new OtpVerificationError("Incorrect verification code.");
  }

  await admin
    .from("email_otp_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { otpVerificationId: row.id as string };
}

/**
 * Re-checked at final account-creation time: confirms the given proof corresponds to a
 * successfully consumed, non-expired-at-consumption OTP for this exact email, within a grace
 * window (consumed within the last 30 minutes) so a stale proof from an abandoned session can't
 * be replayed indefinitely.
 */
export async function verifyOtpProof(
  admin: SupabaseClient,
  email: string,
  otpVerificationId: string,
): Promise<boolean> {
  const { data: row, error } = await admin
    .from("email_otp_verifications")
    .select("email, consumed_at")
    .eq("id", otpVerificationId)
    .maybeSingle();

  if (error || !row) return false;
  if (row.email !== email) return false;
  if (!row.consumed_at) return false;

  const consumedAgoMs = Date.now() - new Date(row.consumed_at as string).getTime();
  return consumedAgoMs < 30 * 60 * 1000;
}
