import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";

const STEPS = [
  {
    n: "01",
    t: "INGEST",
    b: "Connect CAD, ePCR, radio, and bodycam pipelines once. Calyx pulls new incidents the moment they close.",
  },
  {
    n: "02",
    t: "RECONSTRUCT",
    b: "Multi-modal fusion aligns every signal to a unified timeline, down to the second.",
  },
  {
    n: "03",
    t: "ANALYZE",
    b: "Each event is checked against your agency's protocols. Deviations and gaps are flagged with citations.",
  },
  {
    n: "04",
    t: "REPORT",
    b: "An after-action report is generated within minutes, ready for QA review, training, or compliance sign-off.",
  },
];

export function HowItWorks() {
  return (
    <section style={{ padding: "120px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <EditorialHeader
          num="03"
          label="HOW IT WORKS"
          headline="From dispatch to debrief, in minutes."
        />
        <div
          className="editorial-grid"
          style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64 }}
        >
          <div />
          <div
            className="how-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: "1px solid var(--border)",
            }}
          >
            {STEPS.map((s, i) => (
              <Reveal
                key={i}
                delay={i * 0.1}
                style={{
                  padding: "32px 24px 0 0",
                  borderRight:
                    i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
                  paddingLeft: i > 0 ? 24 : 0,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--primary)",
                    letterSpacing: "0.18em",
                    marginBottom: 32,
                    fontWeight: 700,
                  }}
                >
                  STEP {s.n}
                </div>
                <div
                  className="display"
                  style={{ fontSize: "clamp(22px, 2vw, 30px)", marginBottom: 14 }}
                >
                  {s.t}
                </div>
                <div
                  style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}
                >
                  {s.b}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
