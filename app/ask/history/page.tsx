import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedDoctor } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listDoctorQueries } from "@/lib/rag/history";
import { logoutAction } from "../actions";
import styles from "../ask.module.css";

export const metadata: Metadata = {
  title: "Question History — EvidMed AI",
  description: "Your past clinical research questions and answers.",
};

function formatSources(sources: { title: string; tier: 1 | 2 }[]): string {
  return sources.map((s) => `${s.title} (Tier ${s.tier})`).join(", ");
}

export default async function AskHistoryPage() {
  const result = await getAuthedDoctor();

  // Same status-gating as /ask itself — a doctor who isn't verified has never been able to ask
  // anything, so there's no history to show; send them back to /ask, which already renders the
  // right pending/rejected/no-certificate message for every other status.
  if (result.status !== "found" || result.doctor.verificationStatus !== "verified") {
    redirect("/ask");
  }

  const admin = createAdminClient();
  const entries = await listDoctorQueries(admin, result.doctor.id);

  return (
    <main className={styles.page}>
      <form action={logoutAction}>
        <button type="submit" className={styles.logoutButton}>
          Log out
        </button>
      </form>
      <div className={styles.card}>
        <div className={styles.topLinks}>
          <h1 className={styles.heading}>Question History</h1>
          <Link href="/ask" className={styles.navLink}>
            ← Ask a new question
          </Link>
        </div>
        <p className={styles.description}>Your past clinical research questions and answers.</p>

        {entries.length === 0 ? (
          <p className={styles.emptyState}>
            You haven&rsquo;t asked any questions yet. <Link href="/ask">Ask your first one</Link>.
          </p>
        ) : (
          <div className={styles.historyList}>
            {entries.map((entry) => (
              <div key={entry.id} className={styles.historyEntry}>
                <p className={styles.historyQuestion}>{entry.queryText}</p>
                <p className={styles.historyMeta}>
                  {new Date(entry.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {entry.responseText && <p className={styles.historyAnswer}>{entry.responseText}</p>}
                {entry.sources.length > 0 && (
                  <p className={styles.sourcesLine}>Sources: {formatSources(entry.sources)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
