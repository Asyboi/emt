import { useEffect, useState, type CSSProperties } from "react";
import { Logo } from "./Logo";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    padding: "clamp(12px, 1.5vh, 16px) clamp(20px, 3vw, 40px)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    background: scrolled ? "rgba(245,244,240,0.65)" : "rgba(245,244,240,0.5)",
    borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
    transition: "background 0.25s ease, border-color 0.25s ease",
  };

  return (
    <nav style={navStyle}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Logo size={22} fontSize={20} />
      </div>
    </nav>
  );
}
