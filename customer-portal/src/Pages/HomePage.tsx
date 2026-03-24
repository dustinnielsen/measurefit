import { useEffect, useRef, useState } from "react";

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Section wrapper with reveal ─────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(6, 14, 35, 0.95)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "none",
      transition: "all 0.3s ease",
      padding: "0 clamp(1.5rem, 5vw, 4rem)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "68px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: "linear-gradient(135deg, #1E6FFF, #00C2FF)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "-1px",
          fontFamily: "'Outfit', sans-serif",
        }}>W</div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.02em" }}>
          WindowFit
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        {["Features", "Pricing", "FAQ"].map(item => (
          <a key={item} href={`#${item.toLowerCase()}`} style={{
            color: "rgba(255,255,255,0.65)", textDecoration: "none",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", fontWeight: 500,
            transition: "color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
          >{item}</a>
        ))}
        <a href="/signup" style={{
          background: "linear-gradient(135deg, #1E6FFF, #00C2FF)",
          color: "#fff", textDecoration: "none", borderRadius: "8px",
          padding: "9px 22px", fontFamily: "'Outfit', sans-serif",
          fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.01em",
          transition: "opacity 0.2s, transform 0.2s",
          display: "inline-block",
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
        >Get Started →</a>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "120px clamp(1.5rem, 5vw, 4rem) 80px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Grid texture */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `linear-gradient(rgba(30,111,255,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,111,255,0.06) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />
      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: "80vw", height: "60vh", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(30,111,255,0.18) 0%, transparent 70%)",
        zIndex: 0, pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(30,111,255,0.12)", border: "1px solid rgba(30,111,255,0.3)",
          borderRadius: "100px", padding: "6px 16px", marginBottom: "2rem",
          animation: "fadeUp 0.6s ease 0.1s both",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00C2FF", display: "block" }} />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.8rem", color: "#00C2FF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            AR-Powered Window Measurement
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(3.8rem, 9vw, 8rem)",
          lineHeight: 0.92, letterSpacing: "-0.01em",
          color: "#fff", margin: "0 0 1.5rem",
          animation: "fadeUp 0.7s ease 0.25s both",
        }}>
          Measure Windows<br />
          <span style={{
            background: "linear-gradient(90deg, #1E6FFF, #00C2FF)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>In Seconds.</span>
        </h1>

        <p style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 400,
          fontSize: "clamp(1rem, 2vw, 1.2rem)", color: "rgba(255,255,255,0.6)",
          maxWidth: "600px", margin: "0 auto 2.5rem", lineHeight: 1.65,
          animation: "fadeUp 0.7s ease 0.4s both",
        }}>
          WindowFit gives window treatment dealers a mobile AR tool to measure
          accurately, browse products, and generate quotes — all from a phone.
          No tape measure. No callbacks. No mistakes.
        </p>

        <div style={{
          display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap",
          animation: "fadeUp 0.7s ease 0.55s both",
        }}>
          <a href="/signup" style={{
            background: "linear-gradient(135deg, #1E6FFF, #00C2FF)",
            color: "#fff", textDecoration: "none", borderRadius: "10px",
            padding: "15px 34px", fontFamily: "'Outfit', sans-serif",
            fontWeight: 700, fontSize: "1rem", letterSpacing: "0.01em",
            boxShadow: "0 8px 32px rgba(30,111,255,0.35)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(30,111,255,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(30,111,255,0.35)"; }}
          >Start Free Trial</a>
          <a href="#how-it-works" style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", textDecoration: "none", borderRadius: "10px",
            padding: "15px 34px", fontFamily: "'Outfit', sans-serif",
            fontWeight: 600, fontSize: "1rem",
            transition: "background 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >See How It Works</a>
        </div>

        {/* Social proof strip */}
        <div style={{
          marginTop: "4rem", display: "flex", gap: "2.5rem", justifyContent: "center",
          flexWrap: "wrap", animation: "fadeUp 0.7s ease 0.7s both",
        }}>
          {[
            { num: "< 60s", label: "Average measure time" },
            { num: "±1/8\"", label: "Measurement accuracy" },
            { num: "0", label: "Missed callbacks" },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: "#fff", letterSpacing: "0.02em" }}>{num}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem / Solution ───────────────────────────────────────────────────────
function ProblemSolution() {
  return (
    <section style={{ padding: "100px clamp(1.5rem, 5vw, 4rem)", maxWidth: "1200px", margin: "0 auto" }}>
      <Reveal>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "2px", borderRadius: "16px", overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {/* Problem */}
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "3rem" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,100,100,0.8)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              The Problem
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.4rem", color: "#fff", margin: "0 0 1rem", lineHeight: 1 }}>
              Manual Measuring Is Broken
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                "Tape measure errors cause costly remakes",
                "Multiple site visits slow down every job",
                "Paper notes get lost, products mis-ordered",
                "Quoting takes hours back at the office",
              ].map(item => (
                <li key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(255,100,100,0.7)", fontWeight: 700, marginTop: "2px" }}>✕</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div style={{ background: "rgba(30,111,255,0.07)", padding: "3rem", borderLeft: "1px solid rgba(30,111,255,0.2)" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#00C2FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              The Solution
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.4rem", color: "#fff", margin: "0 0 1rem", lineHeight: 1 }}>
              One Phone. Every Window.
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                "AR camera measures to 1/8\" in under a minute",
                "Browse and spec products on-site with the customer",
                "Every measurement auto-saved to the cloud",
                "Generate a quote before you leave the room",
              ].map(item => (
                <li key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ color: "#00C2FF", fontWeight: 700, marginTop: "2px" }}>✓</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.75)", fontSize: "0.95rem", lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { num: "01", title: "Calibrate Once", body: "Place a calibration marker on any window frame. Your phone camera locks in real-world scale automatically." },
    { num: "02", title: "Scan the Window", body: "Point, tap, done. The AR layer captures width, height, and depth without ever touching a tape measure." },
    { num: "03", title: "Browse & Spec", body: "Pull up your dealer catalog — Hunter Douglas, Norman, your own brands — and pick products right from the measurement screen." },
    { num: "04", title: "Generate a Quote", body: "WindowFit auto-calculates pricing from your catalog and sends a professional quote to the customer before you leave." },
  ];
  return (
    <section id="how-it-works" style={{ padding: "100px clamp(1.5rem, 5vw, 4rem)", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: "linear-gradient(180deg, transparent, rgba(30,111,255,0.05) 50%, transparent)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "5rem" }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#1E6FFF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Process</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#fff", margin: 0, lineHeight: 1 }}>
              From Doorbell to Done in 4 Steps
            </h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5px", background: "rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
          {steps.map(({ num, title, body }, i) => (
            <Reveal key={num} delay={i * 100}>
              <div style={{
                background: "rgb(8,16,40)", padding: "2.5rem 2rem",
                borderRight: i < steps.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                height: "100%", boxSizing: "border-box",
                transition: "background 0.3s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,111,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgb(8,16,40)")}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.5rem", color: "rgba(30,111,255,0.25)", lineHeight: 1, marginBottom: "1.25rem" }}>{num}</div>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#fff", margin: "0 0 0.75rem" }}>{title}</h4>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const feats = [
    { icon: "📐", title: "AR Measurement", body: "Sub-1/8\" precision using LiDAR and camera depth mapping. Works on any window, door, or opening." },
    { icon: "📦", title: "Live Product Catalog", body: "Your full dealer catalog — Hunter Douglas, Norman, custom brands — always up to date, always on-device." },
    { icon: "🎨", title: "Visual Configurator", body: "Customers see exactly what their chosen shade, shutter, or blind looks like on their actual window. Real time." },
    { icon: "📋", title: "Instant Quoting", body: "Auto-calculated pricing from your margin settings. Email a polished quote to the homeowner on the spot." },
    { icon: "☁️", title: "Cloud Sync", body: "Every room, window, and measurement saved automatically. Access jobs from the office, truck, or showroom." },
    { icon: "📊", title: "Dealer Dashboard", body: "Track leads, monitor subscription usage, manage catalog, and view revenue analytics from a single portal." },
  ];
  return (
    <section id="features" style={{ padding: "100px clamp(1.5rem, 5vw, 4rem)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "5rem" }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#1E6FFF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Features</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#fff", margin: 0, lineHeight: 1 }}>
              Everything Your Team Needs
            </h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {feats.map(({ icon, title, body }, i) => (
            <Reveal key={title} delay={i * 80}>
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px", padding: "2rem", height: "100%", boxSizing: "border-box",
                transition: "border-color 0.3s, background 0.3s, transform 0.3s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.4)"; e.currentTarget.style.background = "rgba(30,111,255,0.06)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>{icon}</div>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#fff", margin: "0 0 0.6rem" }}>{title}</h4>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: "Basic", price: "$79", period: "/mo",
      description: "Perfect for independent dealers just getting started.",
      features: ["Up to 30 measurements/mo", "1 user seat", "Standard catalog", "Email support"],
      cta: "Start Free Trial", highlight: false,
    },
    {
      name: "Pro", price: "$149", period: "/mo",
      description: "For growing teams who need more power and flexibility.",
      features: ["Unlimited measurements", "5 user seats", "Full catalog + custom products", "Priority support", "Client quote emails"],
      cta: "Start Free Trial", highlight: true,
    },
    {
      name: "Enterprise", price: "$299", period: "/mo",
      description: "Multi-location dealers and high-volume operations.",
      features: ["Unlimited everything", "Unlimited seats", "White-label option", "Dedicated onboarding", "API access"],
      cta: "Contact Sales", highlight: false,
    },
  ];
  return (
    <section id="pricing" style={{ padding: "100px clamp(1.5rem, 5vw, 4rem)", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: "linear-gradient(180deg, transparent, rgba(30,111,255,0.05) 50%, transparent)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "5rem" }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#1E6FFF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Pricing</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#fff", margin: "0 0 1rem", lineHeight: 1 }}>
              Simple, Transparent Pricing
            </h2>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              14-day free trial on all plans. No credit card required.
            </p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
          {plans.map(({ name, price, period, description, features, cta, highlight }, i) => (
            <Reveal key={name} delay={i * 100}>
              <div style={{
                background: highlight ? "linear-gradient(145deg, rgba(30,111,255,0.15), rgba(0,194,255,0.08))" : "rgba(255,255,255,0.03)",
                border: highlight ? "1px solid rgba(30,111,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px", padding: "2.5rem 2rem",
                position: "relative", overflow: "hidden",
                transform: highlight ? "scale(1.03)" : "scale(1)",
                boxShadow: highlight ? "0 0 60px rgba(30,111,255,0.15)" : "none",
              }}>
                {highlight && (
                  <div style={{
                    position: "absolute", top: "1rem", right: "1rem",
                    background: "linear-gradient(135deg, #1E6FFF, #00C2FF)",
                    borderRadius: "100px", padding: "3px 12px",
                    fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 700,
                    color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase",
                  }}>Most Popular</div>
                )}
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: highlight ? "#00C2FF" : "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>{name}</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.2rem", color: "#fff", lineHeight: 1 }}>{price}</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>{period}</span>
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 1.75rem" }}>{description}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {features.map(f => (
                    <li key={f} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                      <span style={{ color: "#1E6FFF", fontSize: "0.9rem", marginTop: "1px" }}>✓</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.65)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href={name === "Enterprise" ? "mailto:hello@windowfit.io" : "/signup"} style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  background: highlight ? "linear-gradient(135deg, #1E6FFF, #00C2FF)" : "rgba(255,255,255,0.08)",
                  color: "#fff", borderRadius: "9px", padding: "12px 0",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                  border: highlight ? "none" : "1px solid rgba(255,255,255,0.12)",
                  transition: "opacity 0.2s, transform 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
                >{cta}</a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "What phones does WindowFit work on?", a: "WindowFit works on any iPhone with ARKit support (iPhone 6s and newer). Android support via ARCore is on our roadmap." },
    { q: "Do I need special equipment to measure?", a: "Just your phone and our optional calibration marker (a printed sheet or sticker). No laser tool, no tape measure, no partner holding the other end." },
    { q: "How does the product catalog work?", a: "We load your active dealer catalog into WindowFit — Hunter Douglas, Norman, and any custom brands. Products include all available colors, fabrics, and options so you can spec on the spot." },
    { q: "Can multiple salespeople use one account?", a: "Yes. Pro and Enterprise plans include multiple user seats. Each user has their own login and their jobs are organized separately in the shared account." },
    { q: "What happens after my free trial?", a: "You'll be prompted to choose a plan and enter a card. All your data carries forward. If you don't upgrade, your account is paused — nothing is deleted." },
    { q: "Is there a long-term contract?", a: "No. WindowFit is month-to-month on all plans. Cancel any time from your billing portal." },
  ];
  return (
    <section id="faq" style={{ padding: "100px clamp(1.5rem, 5vw, 4rem)" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#1E6FFF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>FAQ</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#fff", margin: 0, lineHeight: 1 }}>
              Common Questions
            </h2>
          </div>
        </Reveal>
        {faqs.map(({ q, a }, i) => (
          <Reveal key={i} delay={i * 60}>
            <div style={{
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: "1.4rem 0", display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: "1rem", textAlign: "left",
              }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.97rem", color: "#fff" }}>{q}</span>
                <span style={{
                  color: "#1E6FFF", fontSize: "1.2rem", fontWeight: 300,
                  transform: open === i ? "rotate(45deg)" : "rotate(0)",
                  transition: "transform 0.3s", flexShrink: 0,
                }}>+</span>
              </button>
              <div style={{
                maxHeight: open === i ? "200px" : "0",
                overflow: "hidden", transition: "max-height 0.4s ease",
              }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 1.4rem", paddingRight: "2rem" }}>{a}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────
function FooterCTA() {
  return (
    <section style={{ padding: "100px clamp(1.5rem, 5vw, 4rem) 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "600px", height: "300px", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(30,111,255,0.2), transparent 70%)",
        pointerEvents: "none",
      }} />
      <Reveal>
        <div style={{ position: "relative", zIndex: 1, maxWidth: "640px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 7vw, 5.5rem)", color: "#fff", margin: "0 0 1.25rem", lineHeight: 0.95 }}>
            Ready to Measure<br />
            <span style={{ background: "linear-gradient(90deg, #1E6FFF, #00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Smarter?</span>
          </h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.55)", margin: "0 0 2.5rem", lineHeight: 1.6 }}>
            Join the dealers who've eliminated tape measures, cut callbacks, and closed more jobs on the first visit.
          </p>
          <a href="/signup" style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #1E6FFF, #00C2FF)",
            color: "#fff", textDecoration: "none", borderRadius: "10px",
            padding: "16px 40px", fontFamily: "'Outfit', sans-serif",
            fontWeight: 700, fontSize: "1.05rem",
            boxShadow: "0 8px 40px rgba(30,111,255,0.4)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 14px 50px rgba(30,111,255,0.55)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 40px rgba(30,111,255,0.4)"; }}
          >Start Your Free Trial →</a>
        </div>
      </Reveal>

      {/* Footer links */}
      <div style={{ marginTop: "5rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg, #1E6FFF, #00C2FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, color: "#fff", fontFamily: "'Outfit', sans-serif" }}>W</div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "rgba(255,255,255,0.5)" }}>WindowFit</span>
        </div>
        <div style={{ display: "flex", gap: "2rem" }}>
          {["Privacy", "Terms", "Contact"].map(item => (
            <a key={item} href="#" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>{item}</a>
          ))}
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} WindowFit. All rights reserved.
        </span>
      </div>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      {/* Font imports */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        html { scroll-behavior: smooth; }

        body {
          margin: 0;
          background: #060E23;
          color: #fff;
          -webkit-font-smoothing: antialiased;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Nav />
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <FooterCTA />
    </>
  );
}