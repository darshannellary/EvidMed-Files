import { createClient } from "@/lib/supabase/server";

export interface AuthedDoctor {
  id: string;
  verificationStatus: "pending" | "verified" | "rejected";
  certificatePath: string | null;
  rejectionReason: string | null;
}

export type AuthedDoctorResult =
  | { status: "unauthenticated" }
  | { status: "no_doctor_row" }
  | { status: "found"; doctor: AuthedDoctor };

/**
 * Uses the authenticated (anon-key, RLS-scoped) server client, not the admin client — relies on
 * the doctors_select_own RLS policy to scope the query to the signed-in user's own row.
 */
export async function getAuthedDoctor(): Promise<AuthedDoctorResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("doctors")
    .select("id, verification_status, certificate_path, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { status: "no_doctor_row" };
  }

  return {
    status: "found",
    doctor: {
      id: data.id as string,
      verificationStatus: data.verification_status as AuthedDoctor["verificationStatus"],
      certificatePath: data.certificate_path as string | null,
      rejectionReason: data.rejection_reason as string | null,
    },
  };
}
