"use client";

import { useActionState } from "react";
import { submitDoctorAction, type SubmitDoctorActionState } from "./actions";

const INITIAL_STATE: SubmitDoctorActionState = { status: "idle" };

const KNOWN_COUNCILS = [
  "National Medical Commission (NMC)",
  "Andhra Pradesh Medical Council",
  "Delhi Medical Council",
  "Karnataka Medical Council",
  "Kerala Medical Council",
  "Maharashtra Medical Council",
  "Tamil Nadu Medical Council",
  "West Bengal Medical Council",
];

export function VerifyForm() {
  const [state, formAction, isPending] = useActionState(submitDoctorAction, INITIAL_STATE);

  if (state.status === "success") {
    return <p role="status">{state.message}</p>;
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <label>
        Full name
        <input name="name" required minLength={2} maxLength={200} />
      </label>

      <label>
        Registration council (e.g. NMC or your state medical council)
        <input name="registrationCouncil" required list="councils" />
        <datalist id="councils">
          {KNOWN_COUNCILS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <label>
        Registration number
        <input name="registrationNumber" required minLength={2} maxLength={100} />
      </label>

      <label>
        Contact phone (optional — used only to follow up on your application)
        <input name="contactPhone" type="tel" />
      </label>

      <label>
        Contact email (optional — used only to follow up on your application)
        <input name="contactEmail" type="email" />
      </label>

      <label>
        Registration certificate (PDF, JPEG, or PNG, up to 10MB)
        <input name="certificate" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
      </label>

      {state.status === "error" && (
        <p role="alert" style={{ color: "crimson" }}>
          {state.message}
        </p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit for verification"}
      </button>
    </form>
  );
}
