"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { submitDoctor, InvalidSubmissionError, DuplicateSubmissionError } from "@/lib/doctors/submit";
import { CertificateUploadError } from "@/lib/doctors/storage";

export interface SubmitDoctorActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitDoctorAction(
  _prevState: SubmitDoctorActionState,
  formData: FormData,
): Promise<SubmitDoctorActionState> {
  const certificateFile = formData.get("certificate");
  if (!(certificateFile instanceof File) || certificateFile.size === 0) {
    return { status: "error", message: "Please select a certificate file to upload." };
  }

  const input = {
    name: String(formData.get("name") ?? ""),
    registrationCouncil: String(formData.get("registrationCouncil") ?? ""),
    registrationNumber: String(formData.get("registrationNumber") ?? ""),
    contactPhone: (formData.get("contactPhone") as string | null)?.trim() || null,
    contactEmail: (formData.get("contactEmail") as string | null)?.trim() || null,
  };

  try {
    const admin = createAdminClient();
    await submitDoctor(admin, input, certificateFile);
    return {
      status: "success",
      message:
        "Submitted. Your registration will be manually reviewed, typically within a few hours.",
    };
  } catch (err) {
    if (err instanceof InvalidSubmissionError) {
      return { status: "error", message: err.errors.join(" ") };
    }
    if (err instanceof DuplicateSubmissionError || err instanceof CertificateUploadError) {
      return { status: "error", message: err.message };
    }
    console.error("[verify] submission failed:", err);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
