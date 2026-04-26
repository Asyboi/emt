import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";

const NAV_ITEMS = ["PLATFORM", "SOLUTIONS", "CUSTOMERS", "COMPANY"];

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
    padding: "16px 40px",
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
        <Logo size={29} fontSize={26} />
        <div
          style={{ display: "flex", alignItems: "center", gap: 32 }}
          className="nav-links"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--text-2)",
                letterSpacing: "0.14em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
            >
              {item}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: "9px 16px" }}>
            DASHBOARD
          </Link>
        </div>
      </div>
    </nav>
  );
}
