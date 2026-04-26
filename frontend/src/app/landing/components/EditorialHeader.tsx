import type { ReactNode } from "react";
import { Reveal, RevealWords } from "../lib/reveal";

type EditorialHeaderProps = {
  num: string;
  label: string;
  headline: ReactNode;
  body?: ReactNode;
};

export function EditorialHeader({ num, label, headline, body }: EditorialHeaderProps) {
  return (
    <div
      className="editorial-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 200px) 1fr",
        gap: "clamp(32px, 5vw, 64px)",
        marginBottom: "clamp(48px, 8vh, 80px)",
        alignItems: "start",
      }}
    >
      <div>
        <Reveal>
          <div
            className="mono"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            {num}
          </div>
          <div className="label">{label}</div>
        </Reveal>
      </div>
      <div>
        <h2
          className="display"
          style={{
            fontSize: "clamp(30px, min(4.5vw, 6vh), 64px)",
            maxWidth: "16ch",
            marginBottom: body ? "clamp(20px, 3vh, 28px)" : 0,
          }}
        >
          <RevealWords>{headline}</RevealWords>
        </h2>
        {body && (
          <Reveal delay={0.2}>
            <p
              style={{
                fontSize: "clamp(15px, 1.3vw, 17px)",
                color: "var(--text-2)",
                lineHeight: 1.55,
                maxWidth: "60ch",
              }}
            >
              {body}
            </p>
          </Reveal>
        )}
      </div>
    </div>
  );
}
