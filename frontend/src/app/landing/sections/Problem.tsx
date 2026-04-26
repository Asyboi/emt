import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";

const POINTS = [
  {
    t: "QA CAPACITY",
    b: "QA teams sample a fraction of calls. The rest disappear into the run sheet, unseen.",
  },
  {
    t: "MANUAL LABOR",
    b: "Pulling CAD, dispatch audio, ePCR notes, and bodycam into one timeline takes a full shift.",
  },
  {
    t: "HUMAN COST",
    b: "Asking a crew to rewatch a code or pediatric call is a clinical and human burden.",
  },
  {
    t: "LIABILITY",
    b: "Every uncaught protocol drift becomes a future deposition, complaint, or settlement.",
  },
];

export function Problem() {
  return (
    <section style={{ padding: "clamp(72px, 12vh, 120px) 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <EditorialHeader
          num="01"
          label="THE PROBLEM"
          headline={
            <>
              Most calls are <span style={{ color: "var(--muted)" }}>never reviewed.</span>
            </>
          }
          body="In EMS, the call ends and the next one starts. Reviewing a run takes hours nobody has, surfaces details nobody wrote down, and asks crews to relive the worst moments of their week."
        />
        <div
          className="editorial-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(120px, 200px) 1fr", gap: "clamp(32px, 5vw, 64px)" }}
        >
          <div />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {POINTS.map((p, i) => (
              <Reveal
                key={i}
                delay={i * 0.08}
                style={{
                  padding: "0 24px 0 0",
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  paddingLeft: i > 0 ? 24 : 0,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--primary)",
                    letterSpacing: "0.14em",
                    marginBottom: 12,
                  }}
                >
                  0{i + 1}
                </div>
                <div
                  className="label label-strong"
                  style={{ marginBottom: 12, fontSize: 12 }}
                >
                  {p.t}
                </div>
                <div
                  style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}
                >
                  {p.b}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
