"use server";

import { redirect } from "next/navigation";
import { getAuthedDoctor } from "@/lib/auth/session";
import { answerQuery } from "@/lib/rag/pipeline";
import { createClient } from "@/lib/supabase/server";

export interface AskFormState {
  error?: string;
  responseText?: string;
  citationCount?: number;
  // Echoed back so the UI can still show what was asked after React resets the form's own
  // textarea on action success — the textarea's DOM value isn't a reliable source once that
  // happens, but this survives in the action's returned state.
  queryText?: string;
}

export async function askAction(
  _prevState: AskFormState,
  formData: FormData,
): Promise<AskFormState> {
  // Re-derive the doctor from the session server-side — never trust the page-level gate alone,
  // since Server Actions are independently invocable.
  const result = await getAuthedDoctor();
  if (result.status !== "found" || result.doctor.verificationStatus !== "verified") {
    return { error: "You must be a verified doctor to ask a question." };
  }

  const queryText = String(formData.get("queryText") ?? "").trim();
  if (!queryText) {
    return { error: "Enter a question." };
  }

  try {
    const { responseText, citationCount } = await answerQuery({
      doctorId: result.doctor.id,
      queryText,
    });
    return { responseText, citationCount, queryText };
  } catch (err) {
    console.error("[ask] query failed:", err);
    return {
      error: "Something went wrong answering your question. Please try again.",
      queryText,
    };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
