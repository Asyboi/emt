type Severity = "danger" | "warn";

type Flag = {
  sev: string;
  text: string;
  c: Severity;
};

const FLAGS: Flag[] = [
  {
    sev: "CRITICAL",
    text: "Rhythm check gap (4:00) between 14:31 and 14:35 · Protocol §4.2.1",
    c: "danger",
  },
  {
    sev: "DEVIATION",
    text: "Epinephrine 1mg administered 4.5 min late · Protocol §4.3.1",
    c: "warn",
  },
  {
    sev: "DEVIATION",
    text: "Family/bystander communication not documented in ePCR",
    c: "warn",
  },
];

export function ReportView() {
  return (
    <div
      className="preview-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 32,
        fontSize: 13.5,
        lineHeight: 1.6,
      }}
    >
      <div>
        <div className="label" style={{ marginBottom: 6 }}>
          AFTER-ACTION REPORT
        </div>
        <h3 className="display" style={{ fontSize: 24, marginBottom: 18 }}>
          Incident 2438: Cardiac arrest, ROSC achieved
        </h3>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: "8px 16px",
            marginBottom: 24,
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>DATE</span>
          <span style={{ color: "var(--text)" }}>JUL 23, 2026 · 14:18</span>
          <span style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>UNIT</span>
          <span style={{ color: "var(--text)" }}>MEDIC-2</span>
          <span style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>DURATION</span>
          <span style={{ color: "var(--text)" }}>
            23 MIN ON SCENE · 7 MIN TRANSPORT
          </span>
          <span style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>OUTCOME</span>
          <span style={{ color: "var(--success)" }}>ROSC, SUSTAINED AT HANDOFF</span>
        </div>
        <div className="label label-strong" style={{ marginBottom: 8 }}>
          SUMMARY
        </div>
        <p style={{ color: "var(--text-2)", marginBottom: 18 }}>
          Crew responded to a 67-year-old male in cardiac arrest. CPR was in progress on
          arrival. The team executed a clean ALS resuscitation: rapid LUCAS deployment,
          on-protocol defibrillation, and timely advanced airway placement. ROSC achieved
          at 23:53 from arrival, sustained through hospital handoff.
        </p>
        <div className="label label-strong" style={{ marginBottom: 8 }}>
          RECOMMENDATIONS
        </div>
        <ul
          style={{
            color: "var(--text-2)",
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <li>
            Review epinephrine timing protocol with M-2 crew (4.5 min late vs. ≤5 min
            target).
          </li>
          <li>Address rhythm-check cadence: 4-minute gap during compressions.</li>
          <li>
            Crew commendation: compression fraction 87%, airway placed cleanly first
            attempt.
          </li>
        </ul>
      </div>
      <div>
        <div className="label label-strong" style={{ marginBottom: 12 }}>
          KEY FLAGS
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {FLAGS.map((f, i) => {
            const isDanger = f.c === "danger";
            return (
              <div
                key={i}
                style={{
                  padding: "12px 14px",
                  border: `1px solid ${
                    isDanger ? "rgba(179,58,58,0.30)" : "color-mix(in srgb, var(--primary) 30%, transparent)"
                  }`,
                  borderLeft: `2px solid ${isDanger ? "var(--danger)" : "var(--primary)"}`,
                  background: isDanger
                    ? "rgba(179,58,58,0.04)"
                    : "color-mix(in srgb, var(--primary) 4%, transparent)",
                  fontSize: 13,
                  color: "var(--text-2)",
                  borderRadius: 4,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: isDanger ? "var(--danger)" : "var(--primary)",
                    marginRight: 8,
                    letterSpacing: "0.10em",
                    fontWeight: 700,
                  }}
                >
                  {f.sev}
                </span>
                {f.text}
              </div>
            );
          })}
        </div>
        <div className="label label-strong" style={{ marginBottom: 12 }}>
          SOURCES
        </div>
        <div
          className="mono"
          style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.85 }}
        >
          ▸ dispatch_2438.json (CAD)
          <br />
          ▸ narrative_2438.pdf (ePCR)
          <br />
          ▸ channel_4_0723.wav (RADIO)
          <br />
          ▸ medic_2_0723.mp4 (BODYCAM)
          <br />
          ▸ lucas_2438.csv (TELEMETRY)
        </div>
      </div>
    </div>
  );
}
