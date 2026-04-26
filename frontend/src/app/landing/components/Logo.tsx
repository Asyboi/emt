type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  fontSize?: number;
};

export function Logo({ size = 22, showWordmark = true, fontSize = 20 }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img
        src="/calyx-logo.png"
        alt="Calyx"
        style={{ width: size, height: size, objectFit: "contain", display: "block" }}
      />
      {showWordmark && (
        <span
          className="mono"
          style={{
            fontSize,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text)",
          }}
        >
          CALYX
        </span>
      )}
    </div>
  );
}
