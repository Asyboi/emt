import { useState } from "react";
import { EditorialHeader } from "../components/EditorialHeader";
import { Reveal } from "../lib/reveal";
import { TimelineView } from "./preview/TimelineView";
import { ProtocolView } from "./preview/ProtocolView";
import { ReportView } from "./preview/ReportView";

type TabId = "timeline" | "protocol" | "report";

const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "TIMELINE" },
  { id: "protocol", label: "PROTOCOL COMPARISON" },
  { id: "report", label: "AAR" },
];

export function ProductPreview() {
  const [tab, setTab] = useState<TabId>("timeline");

  return (
    <section
      id="preview"
      style={{
        padding: "clamp(72px, 12vh, 120px) 0 0",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="container">
        <EditorialHeader
          num="04"
          label="PRODUCT"
          headline="An incident, reconstructed."
          body="Sample after-action report from a closed cardiac arrest call. Every event is sourced and time-stamped; every flag is traced to a specific protocol clause."
        />
      </div>

      <div style={{ padding: "0 clamp(20px, 3vw, 40px)" }}>
        <Reveal>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderTop: "2px solid var(--primary)",
              overflow: "hidden",
              maxWidth: 1600,
              margin: "0 auto",
              boxShadow: "0 30px 80px rgba(26,26,26,0.10)",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 18px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  color: "var(--text)",
                }}
              >
                INC-2026-07-2438
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--text-2)",
                  letterSpacing: "0.08em",
                }}
              >
                · CARDIAC ARREST · M-2 · 07.23.26 14:18
              </span>
              <div style={{ flex: 1 }} />
              <span className="badge badge-green">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: "var(--success)",
                    borderRadius: 100,
                  }}
                />
                COMPLETE
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid var(--border)",
                padding: "0 18px",
                background: "var(--surface)",
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="mono"
                  style={{
                    padding: "14px 18px",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: tab === t.id ? "var(--text)" : "var(--text-2)",
                    borderBottom:
                      tab === t.id ? "2px solid var(--primary)" : "2px solid transparent",
                    marginBottom: -1,
                    fontWeight: tab === t.id ? 700 : 400,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "clamp(16px, 2vw, 24px)", minHeight: "clamp(380px, 56vh, 540px)" }}>
              {tab === "timeline" && <TimelineView />}
              {tab === "protocol" && <ProtocolView />}
              {tab === "report" && <ReportView />}
            </div>
          </div>
        </Reveal>
      </div>
      <div style={{ height: "clamp(72px, 12vh, 120px)" }} />
    </section>
  );
}
