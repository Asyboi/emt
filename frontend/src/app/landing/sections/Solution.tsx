import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";

const SOURCES = [
  { src: "CAD-LOG", detail: "dispatch_2438.json", size: "12.4 KB" },
  { src: "EPCR-REPORT", detail: "narrative_2438.pdf", size: "284 KB" },
  { src: "DISPATCH-AUDIO", detail: "channel_4_0723.wav", size: "18.2 MB" },
  { src: "BODYCAM-VIDEO", detail: "medic_2_0723.mp4", size: "412 MB" },
];

const CAPABILITIES = [
  {
    n: "01",
    t: "TIME-ALIGNED RECONSTRUCTION",
    b: "Every dispatch frame, radio transmission, on-scene action, and ePCR entry merged into one playable timeline.",
  },
  {
    n: "02",
    t: "PROTOCOL COMPARISON",
    b: "Compares actions against your agency's specific protocols, not a generic ALS template.",
  },
  {
    n: "03",
    t: "RISK SURFACING",
    b: "Identifies missed assessments, late interventions, off-protocol drug doses, and undocumented decisions.",
  },
  {
    n: "04",
    t: "PRIVACY-FIRST REVIEW",
    b: "Crews review structured findings, not raw video, so QA happens without retraumatizing the people who ran the call.",
  },
];

export function Solution() {
  return (
    <section
      style={{
        padding: "clamp(72px, 12vh, 120px) 0",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="container">
        <EditorialHeader
          num="02"
          label="THE PLATFORM"
          headline={
            <>
              One system of record{" "}
              <span style={{ color: "var(--muted)" }}>for every call.</span>
            </>
          }
          body="Calyx fuses your existing data sources into a single, time-aligned reconstruction, then runs it against your protocols and surfaces what mattered."
        />

        <div
          className="solution-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: "clamp(28px, 4.5vw, 56px)",
            alignItems: "stretch",
          }}
        >
          <Reveal>
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderLeft: "2px solid var(--primary)",
                padding: "22px 24px",
                height: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--text)",
                  }}
                >
                  INGEST-PIPELINE · ORCHESTRATOR · HAIKU 4.5
                </div>
                <span className="badge badge-amber">
                  <span
                    className="pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      background: "var(--primary)",
                      borderRadius: 100,
                    }}
                  />
                  RUNNING · 4/4 SOURCES
                </span>
              </div>

              <div className="hr-line" style={{ marginBottom: 16 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SOURCES.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      background: "var(--subcard)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: "var(--success)",
                        borderRadius: 100,
                      }}
                    />
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          color: "var(--text)",
                        }}
                      >
                        {s.src}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 10.5, color: "var(--text-2)" }}
                      >
                        {s.detail}
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--text-2)" }}
                    >
                      {s.size}
                    </span>
                    <span className="badge badge-green">OK</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  margin: "18px 0",
                  color: "var(--muted)",
                }}
              >
                <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
                  <path
                    d="M7 0v18M1 13l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "var(--primary)",
                    }}
                  >
                    RECONSTRUCTED-INCIDENT
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-2)",
                      marginTop: 2,
                    }}
                  >
                    incident_2438.calyx · 47 EVENTS · 23 MIN
                  </div>
                </div>
                <span className="badge badge-amber">READY</span>
              </div>
            </div>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {CAPABILITIES.map((c, i) => (
              <Reveal
                key={i}
                delay={i * 0.08}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr",
                  gap: 24,
                  padding: "22px 0",
                  borderBottom:
                    i < CAPABILITIES.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {c.n}
                </span>
                <div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.09em",
                      color: "var(--text)",
                      marginBottom: 8,
                    }}
                  >
                    {c.t}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text-2)",
                      lineHeight: 1.55,
                    }}
                  >
                    {c.b}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
