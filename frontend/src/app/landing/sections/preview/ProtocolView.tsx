type Status = "ok" | "warn" | "fail";

type Row = {
  action: string;
  expected: string;
  actual: string;
  status: Status;
};

const ROWS: Row[] = [
  { action: "Initial rhythm check", expected: "≤2 min from arrival", actual: "1:23", status: "ok" },
  {
    action: "First defibrillation (VF)",
    expected: "200J biphasic",
    actual: "200J biphasic",
    status: "ok",
  },
  { action: "Epinephrine 1mg IV", expected: "≤5 min from arrest", actual: "9:30", status: "warn" },
  {
    action: "Advanced airway",
    expected: "After 2nd cycle",
    actual: "iGel @ 7:30",
    status: "ok",
  },
  {
    action: "Rhythm check cadence",
    expected: "Every 2 min",
    actual: "Gap of 4:00",
    status: "fail",
  },
  {
    action: "Capnography monitoring",
    expected: "Continuous post-airway",
    actual: "Continuous",
    status: "ok",
  },
  { action: "Compression fraction", expected: "≥80%", actual: "87%", status: "ok" },
  {
    action: "Family communication",
    expected: "Documented",
    actual: "Not documented",
    status: "warn",
  },
  {
    action: "Hospital pre-notification",
    expected: "≤3 min before arrival",
    actual: "5:12 before",
    status: "ok",
  },
];

const LABELS: Record<Status, string> = {
  ok: "ON PROTOCOL",
  warn: "DEVIATION",
  fail: "CRITICAL",
};

const CLASSES: Record<Status, string> = {
  ok: "badge-green",
  warn: "badge-amber",
  fail: "badge-danger",
};

const actualColor = (status: Status) => {
  if (status === "fail") return "var(--danger)";
  if (status === "warn") return "var(--primary)";
  return "var(--text)";
};

export function ProtocolView() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div className="label">
          PROTOCOL: ADULT CARDIAC ARREST V2.4 · AGENCY-SPECIFIC
        </div>
        <div style={{ flex: 1 }} />
        <div
          className="mono"
          style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-2)" }}
        >
          <span>
            <span style={{ color: "var(--success)" }}>●</span> 6 ON
          </span>
          <span>
            <span style={{ color: "var(--primary)" }}>●</span> 2 DEV
          </span>
          <span>
            <span style={{ color: "var(--danger)" }}>●</span> 1 CRIT
          </span>
        </div>
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div
          className="label"
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1.5fr 1.5fr 130px",
            padding: "12px 16px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span>ACTION</span>
          <span>EXPECTED</span>
          <span>ACTUAL</span>
          <span style={{ textAlign: "right" }}>STATUS</span>
        </div>
        {ROWS.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1.5fr 1.5fr 130px",
              padding: "14px 16px",
              borderBottom: i < ROWS.length - 1 ? "1px solid var(--border)" : "none",
              fontSize: 13.5,
              alignItems: "center",
              background: "var(--bg)",
            }}
          >
            <span style={{ fontWeight: 500 }}>{r.action}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
              {r.expected}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: actualColor(r.status) }}
            >
              {r.actual}
            </span>
            <span
              className={`badge ${CLASSES[r.status]}`}
              style={{ justifySelf: "end" }}
            >
              {LABELS[r.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
