"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedDoctor } from "@/lib/auth/session";
import { attachCertificate } from "@/lib/doctors/submit";
import { CertificateUploadError } from "@/lib/doctors/storage";

export interface AttachCertificateState {
  error?: string;
}

export async function attachCertificateAction(
  prevState: AttachCertificateState,
  formData: FormData,
): Promise<AttachCertificateState> {
  // Re-derive the doctor from the session server-side — never trust a client-passed doctorId.
  const result = await getAuthedDoctor();
  if (result.status !== "found") {
    return { error: "Your session has expired. Please log in again." };
  }
  if (result.doctor.certificatePath) {
    redirect("/ask");
  }

  const certificateFile = formData.get("certificate");
  if (!(certificateFile instanceof File) || certificateFile.size === 0) {
    return { error: "Please select a certificate file to upload." };
  }

  try {
    const admin = createAdminClient();
    await attachCertificate(admin, result.doctor.id, certificateFile);
  } catch (err) {
    if (err instanceof CertificateUploadError) {
      return { error: err.message };
    }
    console.error("[verify/certificate] attach failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/ask");
}
