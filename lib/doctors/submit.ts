import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorSubmissionInput } from "./types";
import { validateSubmission } from "./validate";
import { normalizeIndianPhone } from "./phone";
import { verifyOtpProof } from "./otp";
import { uploadCertificate, deleteCertificate } from "./storage";

const UNIQUE_VIOLATION = "23505";

export class InvalidSubmissionError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
  }
}
export class OtpNotVerifiedError extends Error {}
export class AccountExistsError extends Error {}
export class DuplicateSubmissionError extends Error {}

/**
 * Page 1 of /verify. Creates the Supabase Auth account and the doctors row (certificate_path:
 * null — the certificate is attached separately on page 2, see attachCertificate below).
 *
 * Re-verifies the OTP proof server-side regardless of what the UI gated — the UI's disabled
 * attributes are a UX nicety, not the security boundary.
 *
 * On email_exists: rather than attempting to "self-heal" by silently reusing the existing auth
 * account (which would mean granting access to it based only on an OTP proving the *new* password
 * holder controls this email right now — not proof they're the same person who created that
 * account, possibly for an unrelated reason), fail with a clear message directing them to log in
 * or contact support. Safer default for a security-sensitive path, simple enough for pilot scale.
 */
export async function createDoctorAccount(
  admin: SupabaseClient,
  input: DoctorSubmissionInput,
  otpVerificationId: string,
): Promise<{ doctorId: string; userId: string }> {
  const validation = validateSubmission(input);
  if (!validation.valid) {
    throw new InvalidSubmissionError(validation.errors);
  }

  const otpValid = await verifyOtpProof(admin, input.contactEmail, otpVerificationId);
  if (!otpValid) {
    throw new OtpNotVerifiedError("Email verification is missing or expired. Please verify your email again.");
  }

  const phone = normalizeIndianPhone(input.contactPhone);
  if (!phone) {
    // Unreachable given validateSubmission already checked this, but keeps the type narrow.
    throw new InvalidSubmissionError(["Invalid phone number."]);
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.contactEmail,
    password: input.password,
    email_confirm: true, // Email ownership already proven via OTP — skip Supabase's own flow.
  });

  if (authError || !authData.user) {
    if (authError?.code === "email_exists") {
      throw new AccountExistsError(
        "An account already exists for this email. Try logging in instead.",
      );
    }
    throw new Error(`Failed to create account: ${authError?.message ?? "unknown error"}`);
  }

  const userId = authData.user.id;

  const { data: doctorData, error: doctorError } = await admin
    .from("doctors")
    .insert({
      name: input.name.trim(),
      registration_council: input.registrationCouncil.trim(),
      registration_number: input.registrationNumber.trim(),
      contact_phone: phone,
      contact_email: input.contactEmail,
      certificate_path: null,
      user_id: userId,
    })
    .select("id")
    .single();

  if (doctorError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});

    if (doctorError.code === UNIQUE_VIOLATION) {
      throw new DuplicateSubmissionError(
        "A doctor with this registration council and number has already submitted.",
      );
    }
    throw new Error(`Failed to create doctor record: ${doctorError.message}`);
  }

  return { doctorId: doctorData.id as string, userId };
}

/**
 * Page 2 of /verify (/verify/certificate) — authenticated-only. Uploads the certificate and
 * attaches it to the doctor's existing row. Reuses lib/doctors/storage.ts's upload/cleanup logic
 * unchanged.
 */
export async function attachCertificate(
  admin: SupabaseClient,
  doctorId: string,
  certificateFile: File,
): Promise<void> {
  const { path } = await uploadCertificate(admin, certificateFile);

  const { error } = await admin
    .from("doctors")
    .update({ certificate_path: path })
    .eq("id", doctorId);

  if (error) {
    await deleteCertificate(admin, path).catch(() => {});
    throw new Error(`Failed to attach certificate: ${error.message}`);
  }
}
