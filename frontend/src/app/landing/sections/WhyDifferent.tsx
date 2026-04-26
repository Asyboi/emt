import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";

const ROWS = [
  { feature: "WHAT IT INGESTS", others: "ePCR text only", calyx: "CAD · ePCR · audio · video" },
  {
    feature: "WHAT IT PRODUCES",
    others: "Documentation tags",
    calyx: "Full incident reconstruction",
  },
  {
    feature: "PROTOCOL LOGIC",
    others: "Generic ALS template",
    calyx: "Your agency's actual protocols",
  },
  { feature: "COVERAGE", others: "QA-sampled (~3%)", calyx: "Every closed call" },
  { feature: "TIME TO INSIGHT", others: "Days, weeks, never", calyx: "Minutes" },
  {
    feature: "CREW BURDEN",
    others: "Rewatch raw video",
    calyx: "Structured findings only",
  },
];

export function WhyDifferent() {
  return (
    <section style={{ padding: "120px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <EditorialHeader
          num="06"
          label="WHY CALYX"
          headline={
            <>
              Documentation tools tag what happened.{" "}
              <span style={{ color: "var(--muted)" }}>
                Calyx tells you what mattered.
              </span>
            </>
          }
        />
        <div
          className="editorial-grid"
          style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64 }}
        >
          <div />
          <Reveal>
            <div style={{ borderTop: "1px solid var(--text)" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr",
                  padding: "14px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span />
                <span className="label">OTHER QA TOOLS</span>
                <span className="label label-strong">CALYX</span>
              </div>
              {ROWS.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr",
                    padding: "20px 0",
                    borderBottom: "1px solid var(--border)",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.09em",
                      color: "var(--text)",
                    }}
                  >
                    {r.feature}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--muted)" }}>{r.others}</span>
                  <span
                    style={{ fontSize: 16, color: "var(--primary)", fontWeight: 500 }}
                  >
                    {r.calyx}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
