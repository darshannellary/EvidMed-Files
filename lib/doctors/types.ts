export interface DoctorSubmissionInput {
  name: string;
  registrationCouncil: string;
  registrationNumber: string;
  contactPhone: string;
  contactEmail: string;
  password: string;
}

export interface ValidationError {
  valid: false;
  errors: string[];
}

export interface ValidationSuccess {
  valid: true;
}

export type SubmissionValidationResult = ValidationSuccess | ValidationError;

export interface PendingDoctor {
  id: string;
  name: string;
  registration_council: string;
  registration_number: string;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
}
