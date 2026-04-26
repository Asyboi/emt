import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";

const CASES = [
  {
    tag: "EMS-AGENCIES",
    headline: "Service-wide visibility. Not a sample.",
    body: "Operations leaders see every closed call without QA bottlenecks: performance, gaps, and training needs surfaced across the whole service line.",
    stat: "100%",
    statLabel: "OF CLOSED CALLS PROCESSED",
  },
  {
    tag: "TRAINING-AND-QA",
    headline: "Coach, don't reconstruct.",
    body: "QA teams stop spending shifts pulling timelines together and start spending them coaching. Findings come pre-cited to specific protocol clauses.",
    stat: "11 MIN",
    statLabel: "MEDIAN TIME TO A FINISHED AAR",
  },
  {
    tag: "RISK-AND-COMPLIANCE",
    headline: "Defensible by default.",
    body: "Liability-relevant findings escalated within minutes of the call closing. Defensible documentation, complete and consistent across the agency.",
    stat: "0",
    statLabel: "CRITICAL DEVIATIONS MISSED",
  },
];

export function UseCases() {
  return (
    <section style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="container" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <EditorialHeader
          num="05"
          label="SOLUTIONS"
          headline={
            <>
              Three teams.{" "}
              <span style={{ color: "var(--muted)" }}>One source of truth.</span>
            </>
          }
        />
      </div>
      {CASES.map((c, i) => (
        <div
          key={i}
          style={{
            borderTop: "1px solid var(--border)",
            padding: "70px 0",
            background: i % 2 === 1 ? "var(--surface)" : "var(--bg)",
          }}
        >
          <div className="container">
            <Reveal>
              <div
                className="usecase-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr 320px",
                  gap: 64,
                  alignItems: "start",
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>
                    0{i + 1} / SOLUTION
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.09em",
                      color: "var(--text)",
                    }}
                  >
                    {c.tag}
                  </div>
                </div>
                <div>
                  <h3
                    className="display"
                    style={{
                      fontSize: "clamp(28px, 3.5vw, 46px)",
                      marginBottom: 18,
                      maxWidth: "18ch",
                    }}
                  >
                    {c.headline}
                  </h3>
                  <p
                    style={{
                      fontSize: 16,
                      color: "var(--text-2)",
                      lineHeight: 1.55,
                      maxWidth: 560,
                    }}
                  >
                    {c.body}
                  </p>
                  <a
                    href="#"
                    className="mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 24,
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      color: "var(--text)",
                      borderBottom: "1px solid var(--text)",
                      paddingBottom: 4,
                    }}
                  >
                    READ MORE
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
                <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 28 }}>
                  <div
                    className="display"
                    style={{
                      fontSize: "clamp(48px, 6vw, 80px)",
                      color: "var(--primary)",
                      marginBottom: 12,
                      fontWeight: 300,
                    }}
                  >
                    {c.stat}
                  </div>
                  <div className="label">{c.statLabel}</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      ))}
    </section>
  );
}
