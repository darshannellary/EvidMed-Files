"use server";

import { redirect } from "next/navigation";
import { getAuthedDoctor } from "@/lib/auth/session";
import { answerQuery } from "@/lib/rag/pipeline";
import { createClient } from "@/lib/supabase/server";

export interface AskFormState {
  error?: string;
  responseText?: string;
  citationCount?: number;
  sources?: { title: string; source: string; tier: 1 | 2 }[];
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
    const { responseText, citationCount, sources } = await answerQuery({
      doctorId: result.doctor.id,
      queryText,
    });
    return { responseText, citationCount, sources };
  } catch (err) {
    console.error("[ask] query failed:", err);
    return { error: "Something went wrong answering your question. Please try again." };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
