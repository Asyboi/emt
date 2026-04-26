import { Reveal } from "../lib/reveal";

const ANCHOR = {
  v: "<3%",
  l: "of EMS calls today get a full quality review.",
};

const SUPPORTING = [
  { v: "6 HR+", l: "to reconstruct one incident by hand" },
  { v: "1 IN 4", l: "medics screen positive for PTSD" },
  { v: "$12M", l: "average liability per missed deviation" },
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
          <div className="section-marker" style={{ marginBottom: 72 }}>
            00 / WHY THIS MATTERS
          </div>
        </Reveal>

        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            columnGap: 80,
            rowGap: 56,
            alignItems: "start",
          }}
        >
          <Reveal>
            <div
              className="display"
              style={{
                fontSize: "clamp(112px, 16vw, 240px)",
                fontWeight: 300,
                letterSpacing: "-0.04em",
                lineHeight: 0.92,
                marginBottom: 28,
              }}
            >
              {ANCHOR.v}
            </div>
            <p
              style={{
                fontSize: "clamp(18px, 1.6vw, 22px)",
                color: "var(--text-2)",
                lineHeight: 1.4,
                maxWidth: "26ch",
              }}
            >
              {ANCHOR.l}
            </p>
          </Reveal>

          <div style={{ borderTop: "1px solid var(--border)" }}>
            {SUPPORTING.map((s, i) => (
              <Reveal
                key={i}
                delay={0.1 + i * 0.08}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, auto) 1fr",
                  columnGap: 28,
                  alignItems: "baseline",
                  padding: "26px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  className="display"
                  style={{
                    fontSize: "clamp(32px, 3.6vw, 52px)",
                    fontWeight: 300,
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                  }}
                >
                  {s.v}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {s.l}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
