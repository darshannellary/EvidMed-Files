import type { SupabaseClient } from "@supabase/supabase-js";

export interface QueryHistorySource {
  id: string;
  title: string;
  source: string;
  tier: 1 | 2;
}

export interface QueryHistoryEntry {
  id: string;
  queryText: string;
  responseText: string | null;
  responseTimeMs: number | null;
  createdAt: string;
  sources: QueryHistorySource[];
}

const HISTORY_LIMIT = 50;

interface QueryRow {
  id: string;
  query_text: string;
  response_text: string | null;
  response_time_ms: number | null;
  created_at: string;
  citations: Array<{
    documents: { id: string; title: string; source: string; tier: number } | null;
  }> | null;
}

/**
 * Uses the admin (service-role) client, not the RLS-scoped authenticated client — documents has
 * no SELECT policy for authenticated at all (by design: "doctors get content only through
 * synthesized, cited answers, never raw corpus access," see
 * supabase/migrations/20260821110000_doctor_auth_rls.sql), so an RLS-scoped nested
 * citations(documents(...)) join would return every document as null and break source display
 * entirely. The explicit eq("doctor_id", doctorId) below is the only scoping here — no RLS
 * backstop — same trust boundary /ask's own Server Action already relies on: doctorId is
 * re-derived server-side via getAuthedDoctor() before this is ever called, never taken from the
 * client. Showing a doctor the titles of sources already cited in their own past answer isn't the
 * "raw corpus access" that policy was written to prevent — it's strictly less exposure than the
 * synthesized answer text they were already given.
 *
 * Sources are deduplicated per query (by document id) rather than showing one line per citation
 * — a history list is for scanning past questions at a glance, not re-reading every claim, so a
 * compact "Sources: X, Y" line serves that better than repeating claim_text per citation.
 */
export async function listDoctorQueries(
  admin: SupabaseClient,
  doctorId: string,
): Promise<QueryHistoryEntry[]> {
  const { data, error } = await admin
    .from("queries")
    .select(
      `id, query_text, response_text, response_time_ms, created_at,
       citations ( documents ( id, title, source, tier ) )`,
    )
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    throw new Error(`Failed to list query history for doctor ${doctorId}: ${error.message}`);
  }

  return ((data ?? []) as unknown as QueryRow[]).map((row) => {
    const seen = new Set<string>();
    const sources: QueryHistorySource[] = [];
    for (const citation of row.citations ?? []) {
      const doc = citation.documents;
      if (!doc || seen.has(doc.id)) continue;
      seen.add(doc.id);
      sources.push({ id: doc.id, title: doc.title, source: doc.source, tier: doc.tier as 1 | 2 });
    }

    return {
      id: row.id,
      queryText: row.query_text,
      responseText: row.response_text,
      responseTimeMs: row.response_time_ms,
      createdAt: row.created_at,
      sources,
    };
  });
}
