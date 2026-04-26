type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  fontSize?: number;
};

export function Logo({ size = 22, showWordmark = true, fontSize = 20 }: LogoProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        role="img"
        aria-label="Calyx"
        style={{
          width: size,
          height: size,
          display: "block",
          backgroundColor: "var(--primary)",
          WebkitMaskImage: "url(/calyx-logo.png)",
          maskImage: "url(/calyx-logo.png)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            lineHeight: 1,
            display: "inline-block",
          }}
        >
          Calyx
        </span>
      )}
    </div>
  );
}
