import { Logo } from "../components/Logo";

const COLUMNS = [
  { t: "PLATFORM", l: ["Overview", "Ingest", "Reconstruction", "Reports", "Security"] },
  { t: "SOLUTIONS", l: ["EMS agencies", "Training & QA", "Risk & compliance"] },
  { t: "COMPANY", l: ["About", "Customers", "Press", "Careers"] },
  { t: "RESOURCES", l: ["Sample report", "Documentation", "Compliance", "Contact"] },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "clamp(40px, 6vh, 56px) 0 clamp(20px, 3vh, 28px)",
        background: "var(--surface)",
      }}
    >
      <div className="container">
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            gap: "clamp(28px, 4vw, 48px)",
            marginBottom: "clamp(40px, 6vh, 56px)",
          }}
        >
          <div>
            <Logo size={22} fontSize={20} />
            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-2)",
                marginTop: 18,
                lineHeight: 1.5,
                maxWidth: 320,
              }}
            >
              The black box for emergency medical services. Built with EMS leaders, not
              at them.
            </p>
            <div
              className="mono"
              style={{
                marginTop: 24,
                fontSize: 10.5,
                color: "var(--muted)",
                letterSpacing: "0.14em",
              }}
            >
              CALYX HEALTH, INC. · EST. 2026
            </div>
          </div>
          {COLUMNS.map((c, i) => (
            <div key={i}>
              <div className="label label-strong" style={{ marginBottom: 18 }}>
                {c.t}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {c.l.map((item) => (
                  <a
                    key={item}
                    href="#"
                    style={{
                      fontSize: 13.5,
                      color: "var(--text-2)",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text-2)")
                    }
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className="mono"
          style={{
            paddingTop: 22,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              color: "var(--muted)",
              letterSpacing: "0.12em",
            }}
          >
            © 2026 CALYX HEALTH, INC. · ALL RIGHTS RESERVED
          </span>
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 10.5,
              color: "var(--muted)",
              letterSpacing: "0.12em",
            }}
          >
            <a href="#">PRIVACY</a>
            <a href="#">TERMS</a>
            <a href="#">DPA</a>
            <a href="#">RESPONSIBLE DISCLOSURE</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
