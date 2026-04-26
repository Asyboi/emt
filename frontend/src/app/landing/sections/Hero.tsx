import { Link } from "react-router";
import { PixelCross } from "../components/PixelCross";
import { Reveal, RevealWords, ScrollLitText } from "../lib/reveal";

export function Hero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        paddingTop: 100,
      }}
    >
      <div
        className="dot-grid"
        style={{ position: "absolute", inset: 0, opacity: 0.6 }}
      />
      <PixelCross />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(245,244,240,0.55) 0%, rgba(245,244,240,0.85) 55%, var(--bg) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <div style={{ flex: 1, display: "flex", alignItems: "center", paddingTop: 60 }}>
        <div
          className="container"
          style={{ position: "relative", zIndex: 2, width: "100%" }}
        >
          <Reveal>
            <div className="section-marker" style={{ marginBottom: 36 }}>
              <span>INC-2026 · A PLATFORM FOR EMS</span>
            </div>
          </Reveal>

          <h1
            className="display"
            style={{
              fontSize: "clamp(56px, 11vw, 180px)",
              marginBottom: 56,
              maxWidth: "13ch",
            }}
          >
            <RevealWords stagger={0.07} delay={0.1}>
              The black box{" "}
              <span style={{ color: "var(--muted)" }}>
                for emergency medical services.
              </span>
            </RevealWords>
          </h1>

          <Reveal delay={0.4}>
            <div
              className="hero-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 80,
                alignItems: "end",
              }}
            >
              <p
                style={{
                  fontSize: 18,
                  color: "var(--text-2)",
                  lineHeight: 1.5,
                  maxWidth: 540,
                }}
              >
                <ScrollLitText>
                  Calyx ingests CAD, ePCR, audio, and video, then reconstructs every emergency call into a structured, protocol-aware after-action report. Automatically.
                </ScrollLitText>
              </p>
              <div
                className="hero-ctas"
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  justifySelf: "end",
                }}
              >
                <Link to="/dashboard" className="btn btn-primary">
                  DASHBOARD
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <a href="#preview" className="btn btn-ghost">
                  SAMPLE REPORT
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div
        className="container"
        style={{
          position: "relative",
          zIndex: 2,
          paddingBottom: 28,
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
          marginTop: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--muted)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--success)",
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  background: "var(--success)",
                  borderRadius: 100,
                }}
              />
              SYSTEM ONLINE
            </span>
            <span>HIPAA</span>
            <span>SOC 2 TYPE II</span>
            <span>CJIS ALIGNED</span>
            <span>ON-PREM AVAILABLE</span>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--muted)",
              letterSpacing: "0.14em",
            }}
          >
            ↓ SCROLL
          </div>
        </div>
      </div>
    </section>
  );
}
