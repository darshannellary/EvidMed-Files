import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedDoctor } from "@/lib/auth/session";
import { CertificateForm } from "./certificate-form";
import styles from "../verify.module.css";

export const metadata: Metadata = {
  title: "Upload Certificate — EvidMed AI",
  description: "Upload your medical registration certificate to complete verification.",
};

export default async function VerifyCertificatePage() {
  const result = await getAuthedDoctor();

  if (result.status === "unauthenticated" || result.status === "no_doctor_row") {
    redirect("/verify");
  }

  if (result.doctor.certificatePath) {
    // Already uploaded — /ask shows the right pending/verified/rejected status message.
    redirect("/ask");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Upload Your Certificate</h1>
        <p className={styles.description}>
          Step 2 of 2: upload a photo or PDF of your registration certificate to complete your
          application. A member of our team manually reviews submissions, typically within a few
          hours.
        </p>
        <CertificateForm />
      </div>
    </main>
  );
}
