import { Link } from "react-router";
import { Reveal, RevealWords } from "../lib/reveal";

export function FinalCTA() {
  return (
    <section
      id="demo"
      style={{
        padding: "clamp(96px, 16vh, 180px) 0 clamp(80px, 12vh, 140px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="dot-grid"
        style={{ position: "absolute", inset: 0, opacity: 0.5 }}
      />
      <div className="container" style={{ position: "relative" }}>
        <Reveal>
          <div className="section-marker" style={{ marginBottom: "clamp(28px, 4vh, 44px)" }}>
            07 / GET STARTED
          </div>
        </Reveal>
        <h2
          className="display"
          style={{
            fontSize: "clamp(40px, min(8vw, 12vh), 140px)",
            maxWidth: "12ch",
            marginBottom: "clamp(28px, 4vh, 44px)",
          }}
        >
          <RevealWords stagger={0.08}>
            Bring intelligence{" "}
            <span style={{ color: "var(--muted)" }}>to every call.</span>
          </RevealWords>
        </h2>
        <Reveal delay={0.4}>
          <div
            className="cta-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "clamp(32px, 5vw, 64px)",
              alignItems: "end",
              maxWidth: 1200,
            }}
          >
            <p
              style={{
                fontSize: "clamp(15px, 1.4vw, 18px)",
                color: "var(--text-2)",
                maxWidth: "55ch",
                lineHeight: 1.5,
              }}
            >
              See Calyx run on a redacted incident from your own agency. 30-minute demo,
              no integration required.
            </p>
            <div
              style={{ display: "flex", gap: 12, justifySelf: "end", flexWrap: "wrap" }}
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
              <a href="#" className="btn btn-ghost">
                CONTACT SALES
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
