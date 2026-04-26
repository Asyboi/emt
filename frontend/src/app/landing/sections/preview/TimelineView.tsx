type FlagType = "ok" | "warn" | "danger";

type Event = {
  t: string;
  src: string;
  title: string;
  body: string;
  flag?: string;
  flagType?: FlagType;
};

const EVENTS: Event[] = [
  {
    t: "14:18:02",
    src: "CAD",
    title: "CALL RECEIVED",
    body: "Cardiac arrest, M-2 dispatched. ETA 6 min.",
  },
  {
    t: "14:23:48",
    src: "BODYCAM",
    title: "ARRIVAL ON SCENE",
    body: "Patient apneic, pulseless. Bystander CPR in progress.",
  },
  {
    t: "14:24:11",
    src: "EPCR",
    title: "INITIAL ASSESSMENT",
    body: "GCS 3 · pulseless · LUCAS deployed.",
  },
  {
    t: "14:25:02",
    src: "BODYCAM",
    title: "FIRST DEFIBRILLATION",
    body: "200J biphasic. Rhythm: VF → asystole.",
    flag: "ON-PROTOCOL",
    flagType: "ok",
  },
  {
    t: "14:27:40",
    src: "AUDIO",
    title: "EPINEPHRINE 1MG IV",
    body: "Administered 9.5 min after arrest onset.",
    flag: "LATE BY 4.5 MIN · TARGET ≤5 MIN",
    flagType: "warn",
  },
  {
    t: "14:31:18",
    src: "EPCR",
    title: "AIRWAY SECURED",
    body: "iGel placed, capnography 14 mmHg.",
  },
  {
    t: "14:35:02",
    src: "BODYCAM",
    title: "PULSE CHECK MISSED",
    body: "No documented rhythm check between 14:31 and 14:39.",
    flag: "PROTOCOL DEVIATION · 4-MIN GAP",
    flagType: "danger",
  },
  {
    t: "14:41:55",
    src: "EPCR",
    title: "ROSC ACHIEVED",
    body: "Sustained pulse, BP 88/52, transport initiated.",
  },
];

const dotColor = (flagType?: FlagType) => {
  if (flagType === "danger") return "var(--danger)";
  if (flagType === "warn") return "var(--primary)";
  return "var(--success)";
};

const badgeClass = (flagType?: FlagType) => {
  if (flagType === "danger") return "badge-danger";
  if (flagType === "warn") return "badge-amber";
  return "badge-green";
};

export function TimelineView() {
  return (
    <div
      className="preview-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}
    >
      <div>
        <div className="label" style={{ marginBottom: 16 }}>
          47 EVENTS · 23 MIN · 4 SOURCES FUSED
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 80,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--border)",
            }}
          />
          {EVENTS.map((e, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 32px 1fr",
                paddingBottom: 18,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-2)", paddingTop: 2 }}
              >
                {e.t}
              </span>
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    background: dotColor(e.flagType),
                    borderRadius: 100,
                    boxShadow: "0 0 0 4px var(--bg)",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </div>
              <div style={{ paddingLeft: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      color: "var(--muted)",
                      padding: "2px 6px",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {e.src}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "var(--text)",
                    }}
                  >
                    {e.title}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-2)",
                    marginBottom: e.flag ? 8 : 0,
                  }}
                >
                  {e.body}
                </div>
                {e.flag && (
                  <span className={`badge ${badgeClass(e.flagType)}`}>
                    {e.flagType === "ok" ? "✓" : "⚠"} {e.flag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <div className="label" style={{ marginBottom: 12 }}>
            FINDINGS
          </div>
          {[
            { c: "var(--danger)", l: "1 critical deviation" },
            { c: "var(--primary)", l: "2 timing flags" },
            { c: "var(--success)", l: "12 on-protocol actions" },
          ].map((it, j) => (
            <div
              key={j}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              <span
                style={{ width: 6, height: 6, borderRadius: 100, background: it.c }}
              />
              {it.l}
            </div>
          ))}
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "2px solid var(--success)",
            borderRadius: 4,
          }}
        >
          <div className="label" style={{ marginBottom: 10 }}>
            OUTCOME
          </div>
          <div className="display" style={{ fontSize: 28, color: "var(--success)" }}>
            ROSC
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
            Sustained at hospital handoff. Transport time 7 min.
          </div>
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <div className="label" style={{ marginBottom: 10 }}>
            CREW
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.7 }}
          >
            MEDIC-2 · J. REYES (LEAD)
            <br />
            MEDIC-2 · A. PATEL
            <br />
            ENGINE-7 · 4 FF-EMTS
          </div>
        </div>
      </div>
    </div>
  );
}
