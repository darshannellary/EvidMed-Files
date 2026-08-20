import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorSubmissionInput } from "./types";
import { validateSubmission } from "./validate";
import { uploadCertificate, deleteCertificate } from "./storage";

const UNIQUE_VIOLATION = "23505";

export class DuplicateSubmissionError extends Error {}
export class InvalidSubmissionError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
  }
}

/**
 * Upload-then-insert, deliberately NOT the two-phase-nullable pattern used for
 * documents/queries: those are nullable-then-backfilled because the slow step is an unattended
 * batch API call with a real backfill CLI behind it. Here the file IS the reviewable artifact
 * itself, the doctor is present synchronously in the browser, and there's no backfill mechanism
 * (no login) for a doctor to resume a partial submission later — inserting a row before the
 * certificate exists would create a dead-end, unreviewable queue entry. If upload fails, nothing
 * is created and the doctor just resubmits immediately.
 */
export async function submitDoctor(
  admin: SupabaseClient,
  input: DoctorSubmissionInput,
  certificateFile: File,
): Promise<{ id: string }> {
  const validation = validateSubmission(input);
  if (!validation.valid) {
    throw new InvalidSubmissionError(validation.errors);
  }

  const { path } = await uploadCertificate(admin, certificateFile);

  const { data, error } = await admin
    .from("doctors")
    .insert({
      name: input.name.trim(),
      registration_council: input.registrationCouncil.trim(),
      registration_number: input.registrationNumber.trim(),
      contact_phone: input.contactPhone,
      contact_email: input.contactEmail,
      certificate_path: path,
    })
    .select("id")
    .single();

  if (error) {
    // Best-effort cleanup of the just-uploaded object — don't let a cleanup failure mask the
    // original insert error.
    await deleteCertificate(admin, path).catch(() => {});

    if (error.code === UNIQUE_VIOLATION) {
      throw new DuplicateSubmissionError(
        "A doctor with this registration council and number has already submitted.",
      );
    }
    throw new Error(`Failed to submit doctor: ${error.message}`);
  }

  return { id: data.id as string };
}
