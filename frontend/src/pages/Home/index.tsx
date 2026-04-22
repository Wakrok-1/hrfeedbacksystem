import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, Search, Shield, Users, Building2, ChevronRight } from "lucide-react";

const PATHS = [
  {
    key: "worker",
    icon: Users,
    label: "I'm an Employee",
    sub: "Submit a workplace complaint or track an existing case",
    cta: "Submit a Complaint",
    ctaSecondary: "Track my case",
    accent: "#22C55E",
    ring: "rgba(34,197,94,0.15)",
    border: "rgba(34,197,94,0.25)",
    action: "submit",
  },
  {
    key: "admin",
    icon: Shield,
    label: "I'm HR / Admin",
    sub: "Manage incoming complaints, assign vendors, and close cases",
    cta: "Sign in to Dashboard",
    ctaSecondary: null,
    accent: "#38BDF8",
    ring: "rgba(56,189,248,0.12)",
    border: "rgba(56,189,248,0.22)",
    action: "admin",
  },
  {
    key: "vendor",
    icon: Building2,
    label: "I'm a Vendor",
    sub: "View cases assigned to your company and submit action reports",
    cta: "Sign in to Portal",
    ctaSecondary: null,
    accent: "#A78BFA",
    ring: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.22)",
    action: "vendor",
  },
] as const;

export function HomePage() {
  const navigate = useNavigate();
  const [trackRef, setTrackRef] = useState("");
  const [showTrack, setShowTrack] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const t = trackRef.trim();
    if (t) navigate(`/track/${t}`);
  }

  function handleAction(action: string, secondary = false) {
    if (action === "submit") {
      if (secondary) setShowTrack(true);
      else navigate("/submit");
    } else if (action === "admin") navigate("/login?role=admin");
    else if (action === "vendor") navigate("/login?role=vendor");
  }

  return (
    <div style={styles.root}>
      {/* OLED grid */}
      <div style={styles.grid} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoWrap}>
          <div style={styles.logoMark}>HR</div>
          <div>
            <div style={styles.logoName}>Jabil HR Feedback System</div>
            <div style={styles.logoSub}>Penang Operations</div>
          </div>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusDot} />
          System Online
        </div>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.eyebrowWrap}>
          <span style={styles.eyebrow}>Integrated Feedback Portal · 2025</span>
        </div>
        <h1 style={styles.headline}>
          Who are<br />
          <span style={styles.headlineAccent}>you today?</span>
        </h1>
        <p style={styles.heroSub}>
          Select your role to access the right portal. Everything you need is one click away.
        </p>
      </section>

      {/* Path cards */}
      <main style={styles.cards}>
        {PATHS.map((p, i) => {
          const Icon = p.icon;
          const isHovered = hovered === p.key;
          return (
            <div
              key={p.key}
              style={{
                ...styles.card,
                borderColor: isHovered ? p.border : "rgba(255,255,255,0.06)",
                background: isHovered ? p.ring : "rgba(255,255,255,0.02)",
                transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                animationDelay: `${i * 100}ms`,
              }}
              onMouseEnter={() => setHovered(p.key)}
              onMouseLeave={() => setHovered(null)}
              className="home-card-anim"
            >
              {/* Icon */}
              <div style={{ ...styles.iconWrap, background: p.ring, border: `1px solid ${p.border}` }}>
                <Icon size={20} color={p.accent} strokeWidth={1.75} />
              </div>

              {/* Text */}
              <div style={styles.cardBody}>
                <h2 style={styles.cardTitle}>{p.label}</h2>
                <p style={styles.cardSub}>{p.sub}</p>
              </div>

              {/* Track form for worker */}
              {p.key === "worker" && showTrack && (
                <form onSubmit={handleTrack} style={styles.trackForm}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Enter reference ID (e.g. CN-001)"
                    value={trackRef}
                    onChange={(e) => setTrackRef(e.target.value)}
                    style={styles.trackInput}
                  />
                  <button type="submit" style={{ ...styles.trackBtn, background: p.ring, borderColor: p.border, color: p.accent }}>
                    <Search size={14} />
                  </button>
                </form>
              )}

              {/* CTAs */}
              <div style={styles.ctaRow}>
                <button
                  style={{ ...styles.ctaPrimary, background: p.accent }}
                  onClick={() => handleAction(p.action)}
                >
                  {p.cta}
                  <ArrowRight size={14} />
                </button>
                {p.ctaSecondary && !showTrack && (
                  <button
                    style={styles.ctaSecondary}
                    onClick={() => handleAction(p.action, true)}
                  >
                    <Search size={12} />
                    {p.ctaSecondary}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Divider + footer */}
      <footer style={styles.footer}>
        <div style={styles.footerLine} />
        <div style={styles.footerContent}>
          <span>Jabil Circuit Sdn Bhd · Penang</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>Confidential — Authorized personnel only</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>

      <style>{`
        @keyframes cardFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-card-anim {
          animation: cardFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
          transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        @media (max-width: 768px) {
          .home-cards-grid { grid-template-columns: 1fr !important; padding: 0 16px !important; }
          .home-hero-headline { font-size: 38px !important; }
          .home-header-inner { padding: 14px 16px !important; }
        }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { outline: none; border-color: rgba(255,255,255,0.25) !important; }
        @media (prefers-reduced-motion: reduce) {
          .home-card-anim { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Source Sans 3', sans-serif",
    color: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 40px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 9,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    fontFamily: "'Lexend', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.05em",
    color: "#F8FAFC",
    flexShrink: 0,
  },
  logoName: {
    fontFamily: "'Lexend', sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: "rgba(248,250,252,0.75)",
    letterSpacing: "0.01em",
  },
  logoSub: {
    fontSize: 11,
    color: "rgba(248,250,252,0.25)",
    marginTop: 1,
    letterSpacing: "0.04em",
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(34,197,94,0.85)",
    background: "rgba(34,197,94,0.07)",
    border: "1px solid rgba(34,197,94,0.15)",
    borderRadius: 20,
    padding: "5px 13px",
    letterSpacing: "0.03em",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#22C55E",
    display: "inline-block",
    animation: "pulse 2s ease infinite",
  },
  hero: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    padding: "60px 24px 44px",
  },
  eyebrowWrap: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "rgba(248,250,252,0.2)",
  },
  headline: {
    fontFamily: "'Lexend', sans-serif",
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: "-0.025em",
    color: "#F8FAFC",
    margin: "0 0 18px",
  },
  headlineAccent: {
    color: "#22C55E",
  },
  heroSub: {
    fontSize: 15,
    fontWeight: 300,
    color: "rgba(248,250,252,0.38)",
    lineHeight: 1.7,
    margin: 0,
    maxWidth: 420,
    marginLeft: "auto",
    marginRight: "auto",
  },
  cards: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    padding: "0 40px",
    maxWidth: 1080,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box" as const,
    flex: 1,
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    padding: 28,
    cursor: "default",
  },
  iconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 11,
    marginBottom: 20,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    marginBottom: 24,
  },
  cardTitle: {
    fontFamily: "'Lexend', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: "#F8FAFC",
    margin: "0 0 8px",
    letterSpacing: "-0.01em",
  },
  cardSub: {
    fontSize: 13,
    fontWeight: 300,
    color: "rgba(248,250,252,0.38)",
    lineHeight: 1.65,
    margin: 0,
  },
  trackForm: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
  },
  trackInput: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "#F8FAFC",
    fontFamily: "'Source Sans 3', sans-serif",
  },
  trackBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  ctaRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  ctaPrimary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "11px 20px",
    borderRadius: 9,
    border: "none",
    fontFamily: "'Lexend', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: "#020617",
    cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "opacity 0.15s",
  },
  ctaSecondary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "9px 20px",
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    fontFamily: "'Source Sans 3', sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "rgba(248,250,252,0.45)",
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
  },
  footer: {
    position: "relative",
    zIndex: 1,
    marginTop: 48,
  },
  footerLine: {
    height: 1,
    background: "rgba(255,255,255,0.05)",
  },
  footerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "20px 24px",
    fontSize: 11,
    color: "rgba(248,250,252,0.18)",
    letterSpacing: "0.04em",
    flexWrap: "wrap" as const,
  },
};
