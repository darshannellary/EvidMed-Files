import type { DoctorSubmissionInput, SubmissionValidationResult } from "./types";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 200;
const MIN_REG_NUMBER_LENGTH = 2;
const MAX_REG_NUMBER_LENGTH = 100;

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

  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    errors.push("Contact email is not a valid email address.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
