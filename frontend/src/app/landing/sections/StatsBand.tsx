import { Reveal } from "../lib/reveal";

const STATS = [
  { v: "<3%", l: "OF EMS CALLS REVIEWED TODAY" },
  { v: "6 HRS+", l: "TO RECONSTRUCT ONE INCIDENT MANUALLY" },
  { v: "1 IN 4", l: "MEDICS SCREEN POSITIVE FOR PTSD" },
  { v: "$12M", l: "AVG. LIABILITY PER MISSED DEVIATION" },
];

export function StatsBand() {
  return (
    <section
      style={{
        padding: "120px 0",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container">
        <Reveal>
          <div className="section-marker" style={{ marginBottom: 56 }}>
            00 · WHY THIS MATTERS
          </div>
        </Reveal>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            borderTop: "1px solid var(--border)",
          }}
        >
          {STATS.map((s, i) => (
            <Reveal
              key={i}
              delay={i * 0.08}
              style={{
                padding: "40px 32px 32px 0",
                borderRight: i < STATS.length - 1 ? "1px solid var(--border)" : "none",
                paddingLeft: i > 0 ? 32 : 0,
              }}
            >
              <div
                className="display"
                style={{
                  fontSize: "clamp(56px, 7vw, 96px)",
                  marginBottom: 16,
                  fontWeight: 300,
                }}
              >
                {s.v}
              </div>
              <div className="label" style={{ maxWidth: 240, lineHeight: 1.5 }}>
                {s.l}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
