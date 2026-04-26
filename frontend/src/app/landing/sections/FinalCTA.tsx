import { Link } from "react-router";
import { Reveal, RevealWords } from "../lib/reveal";

export function FinalCTA() {
  return (
    <section
      id="demo"
      style={{ padding: "180px 0 140px", position: "relative", overflow: "hidden" }}
    >
      <div
        className="dot-grid"
        style={{ position: "absolute", inset: 0, opacity: 0.5 }}
      />
      <div className="container" style={{ position: "relative" }}>
        <Reveal>
          <div className="section-marker" style={{ marginBottom: 44 }}>
            07 · GET STARTED
          </div>
        </Reveal>
        <h2
          className="display"
          style={{
            fontSize: "clamp(48px, 9vw, 156px)",
            maxWidth: "12ch",
            marginBottom: 44,
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
              gap: 64,
              alignItems: "end",
              maxWidth: 1200,
            }}
          >
            <p
              style={{
                fontSize: 18,
                color: "var(--text-2)",
                maxWidth: 540,
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
