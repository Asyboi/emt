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
        gridTemplateColumns: "200px 1fr",
        gap: 64,
        marginBottom: 80,
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
            fontSize: "clamp(36px, 5vw, 68px)",
            maxWidth: "16ch",
            marginBottom: body ? 28 : 0,
          }}
        >
          <RevealWords>{headline}</RevealWords>
        </h2>
        {body && (
          <Reveal delay={0.2}>
            <p
              style={{
                fontSize: 17,
                color: "var(--text-2)",
                lineHeight: 1.55,
                maxWidth: 640,
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
