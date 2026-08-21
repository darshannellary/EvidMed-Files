import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedDoctor } from "@/lib/auth/session";
import { AskForm } from "./ask-form";
import { logoutAction } from "./actions";
import styles from "../verify/verify.module.css";

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className={styles.logoutButton}>
        Log out
      </button>
    </form>
  );
}

export const metadata: Metadata = {
  title: "Ask — EvidMed AI",
  description: "Ask a cited, evidence-based clinical research question.",
};

export default async function AskPage() {
  const result = await getAuthedDoctor();

  if (result.status === "unauthenticated") {
    redirect("/login");
  }
  if (result.status === "no_doctor_row") {
    redirect("/verify");
  }

  const { doctor } = result;

  if (!doctor.certificatePath) {
    redirect("/verify/certificate");
  }

  if (doctor.verificationStatus === "pending") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <h1 className={styles.heading}>Application Under Review</h1>
            <LogoutButton />
          </div>
          <p className={styles.description}>
            Your registration is under review, typically within a few hours. Check back once
            you&rsquo;ve been notified that it&rsquo;s approved.
          </p>
        </div>
      </main>
    );
  }

  if (doctor.verificationStatus === "rejected") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <h1 className={styles.heading}>Application Not Approved</h1>
            <LogoutButton />
          </div>
          <p className={styles.description}>
            {doctor.rejectionReason
              ? `Your registration was not approved: ${doctor.rejectionReason}`
              : "Your registration was not approved."}{" "}
            Contact support if you believe this is an error.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h1 className={styles.heading}>Ask EvidMed AI</h1>
          <LogoutButton />
        </div>
        <p className={styles.description}>
          Ask a clinical research question. Answers are grounded first in Indian medical guidance
          (ICMR, NHM, NCDC), with every claim carrying an inline citation.
        </p>
        <AskForm />
      </div>
    </main>
  );
}
