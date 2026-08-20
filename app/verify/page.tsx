import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = {
  title: "Doctor Verification — EvidMed AI",
  description: "Submit your medical registration details for manual verification.",
};

export default function VerifyPage() {
  return (
    <main style={{ padding: "4rem 2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Doctor Verification</h1>
      <p>
        Submit your registration details and a photo or PDF of your registration certificate.
        A member of our team manually reviews submissions, typically within a few hours.
      </p>
      <VerifyForm />
    </main>
  );
}
