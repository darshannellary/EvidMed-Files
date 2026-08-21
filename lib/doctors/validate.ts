import type { DoctorSubmissionInput, SubmissionValidationResult } from "./types";
import { normalizeIndianPhone } from "./phone";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 200;
const MIN_REG_NUMBER_LENGTH = 2;
const MAX_REG_NUMBER_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;

// registration_council/registration_number are free-text at the schema level (no check-constraint
// enum — unlike documents.source), since NMC plus ~30 state councils isn't a fixed, enforceable
// list. Light bounds checking here, not a strict enum.
export function validateSubmission(input: DoctorSubmissionInput): SubmissionValidationResult {
  const errors: string[] = [];

  const name = input.name.trim();
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    errors.push(`Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`);
  }

  const council = input.registrationCouncil.trim();
  if (council.length === 0) {
    errors.push("Registration council is required.");
  }

  const regNumber = input.registrationNumber.trim();
  if (regNumber.length < MIN_REG_NUMBER_LENGTH || regNumber.length > MAX_REG_NUMBER_LENGTH) {
    errors.push(
      `Registration number must be between ${MIN_REG_NUMBER_LENGTH} and ${MAX_REG_NUMBER_LENGTH} characters.`,
    );
  }

  if (!input.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    errors.push("A valid email address is required.");
  }

  if (!input.contactPhone || !normalizeIndianPhone(input.contactPhone)) {
    errors.push("A valid Indian mobile number is required (10 digits, starting with 6-9).");
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
