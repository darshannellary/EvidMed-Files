import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <div className={styles.brand}>
            <svg
              className={styles.logoMark}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path
                d="M12 2.5l7.5 3v5.2c0 4.9-3.2 8.9-7.5 10.8-4.3-1.9-7.5-5.9-7.5-10.8V5.5l7.5-3z"
                strokeLinejoin="round"
              />
              <path d="M6.5 13h2.6l1.2-2.4 1.6 4.8 1.2-2.4h2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className={styles.brandText}>
              <span className={styles.brandName}>EvidMed AI</span>
              <span className={styles.brandTagline}>CLINICAL EVIDENCE, VERIFIED</span>
            </div>
          </div>

          <span className={styles.statusBadge}>
            <span className={styles.statusDot} aria-hidden="true" />
            Alpha Testing Live | Public Beta Launching Soon
          </span>
        </nav>

        <div className={styles.hero}>
          <div>
            <h1 className={styles.headline}>
              Indian Clinical Guidance.
              <br />
              Zero Hallucinations.
            </h1>
            <p className={styles.subtext}>
              The AI assistant engineered for Indian doctors. Grounded in national protocols,
              cited to the source, and built for rapid point-of-care decisions.
            </p>
            <Link href="/verify" className={styles.ctaButton}>
              Join the Doctor-Only Beta
            </Link>
          </div>

          <div className={styles.previewWrap}>
            <span className={styles.accessBadge}>
              <svg
                className={styles.accessBadgeIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 2.5l7.5 3v5.2c0 4.9-3.2 8.9-7.5 10.8-4.3-1.9-7.5-5.9-7.5-10.8V5.5l7.5-3z" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Doctor-Only Access
            </span>

            <div className={styles.previewCard}>
              <div className={styles.previewDots}>
                <span />
                <span />
                <span />
              </div>

              <div className={styles.previewSearchRow}>
                <div className={styles.previewSearchInput}>Type clinical question...</div>
                <div className={styles.previewSearchButton}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className={styles.previewResult}>
                <span className={styles.resultChip}>Immediate result</span>
                <div className={styles.resultLines}>
                  <div className={styles.resultLine} style={{ width: "100%" }} />
                  <div className={styles.resultLine} style={{ width: "70%" }} />
                  <div className={styles.resultCited}>Cited</div>
                </div>
              </div>

              <div className={styles.sourceList}>
                <div className={styles.sourceRow}>
                  <span className={styles.sourceBadge} style={{ background: "#2563eb" }} aria-hidden="true" />
                  <span className={styles.sourceName}>ICMR</span>
                </div>
                <div className={styles.sourceRow}>
                  <span className={styles.sourceBadge} style={{ background: "#dc2626" }} aria-hidden="true" />
                  <span className={styles.sourceName}>NHM</span>
                </div>
                <div className={styles.sourceRow}>
                  <span className={styles.sourceBadge} style={{ background: "#16a34a" }} aria-hidden="true" />
                  <span className={styles.sourceName}>NCDC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
