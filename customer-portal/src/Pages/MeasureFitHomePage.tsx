import { useEffect, useRef } from 'react';

const modules = [
  { name: 'WindowFit', tagline: 'Window coverings', color: '#2563EB', live: true },
  { name: 'FloorFit', tagline: 'Flooring', color: '#16A34A', live: false },
  { name: 'CabinetFit', tagline: 'Cabinetry', color: '#B45309', live: false },
  { name: 'TileFit', tagline: 'Tile & stone', color: '#DC2626', live: false },
  { name: 'ClosetFit', tagline: 'Closet systems', color: '#7C3AED', live: false },
  { name: 'BathFit', tagline: 'Bath remodel', color: '#0891B2', live: false },
  { name: 'GarageFit', tagline: 'Garage storage', color: '#EA580C', live: false },
  { name: 'CounterFit', tagline: 'Countertops', color: '#0D9488', live: false },
  { name: 'DoorFit', tagline: 'Doors & trim', color: '#4F46E5', live: false },
  { name: 'StairFit', tagline: 'Stair systems', color: '#BE185D', live: false },
  { name: 'SidingFit', tagline: 'Exterior siding', color: '#65A30D', live: false },
  { name: 'FenceFit', tagline: 'Fencing', color: '#1D4ED8', live: false },
  { name: 'DeckFit', tagline: 'Decking', color: '#CA8A04', live: false },
  { name: 'GutterFit', tagline: 'Gutters', color: '#15803D', live: false },
];

const steps = [
  {
    num: '01',
    title: 'Scan the space',
    body: 'Your dealer uses AR + LiDAR on their phone to capture exact measurements in seconds — no tape measure, no errors.',
  },
  {
    num: '02',
    title: 'Configure & quote',
    body: 'Products, options, and pricing auto-populate. A polished quote reaches your inbox before they leave.',
  },
  {
    num: '03',
    title: 'Approve & pay',
    body: 'Review, sign, and pay online. Your dealer gets the order instantly with every measurement attached.',
  },
];

export default function MeasureFitHomePage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stagger-reveal hero elements on load
    const els = heroRef.current?.querySelectorAll('[data-reveal]');
    els?.forEach((el, i) => {
      (el as HTMLElement).style.animationDelay = `${i * 120}ms`;
      el.classList.add('mf-revealed');
    });
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mf-root {
          font-family: 'DM Sans', sans-serif;
          background: #0D3B36;
          color: #E2F4F1;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ── NAV ── */
        .mf-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          background: rgba(13,59,54,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(94,234,212,0.12);
        }
        .mf-nav-logo {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #5EEAD4;
          letter-spacing: -0.5px;
          text-decoration: none;
        }
        .mf-nav-logo span { color: #E2F4F1; }
        .mf-nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
          list-style: none;
        }
        .mf-nav-links a {
          color: rgba(226,244,241,0.7);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .mf-nav-links a:hover { color: #5EEAD4; }
        .mf-nav-cta {
          background: #5EEAD4;
          color: #0D3B36;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s;
          display: inline-block;
        }
        .mf-nav-cta:hover { background: #99F6E4; transform: translateY(-1px); }

        /* ── HERO ── */
        .mf-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 120px 48px 80px;
          overflow: hidden;
        }
        .mf-hero-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 70% 50%, rgba(15,118,110,0.35) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 10% 80%, rgba(94,234,212,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .mf-hero-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(94,234,212,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(94,234,212,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }
        .mf-hero-content {
          position: relative;
          max-width: 720px;
        }
        .mf-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(94,234,212,0.12);
          border: 1px solid rgba(94,234,212,0.25);
          color: #5EEAD4;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 32px;
        }
        .mf-hero-eyebrow-dot {
          width: 6px; height: 6px;
          background: #5EEAD4;
          border-radius: 50%;
          animation: mf-pulse 2s ease-in-out infinite;
        }
        @keyframes mf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .mf-hero-h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(52px, 7vw, 88px);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -2px;
          color: #E2F4F1;
          margin-bottom: 28px;
        }
        .mf-hero-h1 em {
          font-style: normal;
          color: #5EEAD4;
        }
        .mf-hero-sub {
          font-size: 18px;
          line-height: 1.65;
          color: rgba(226,244,241,0.65);
          max-width: 540px;
          margin-bottom: 48px;
        }
        .mf-hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .mf-btn-primary {
          background: #5EEAD4;
          color: #0D3B36;
          border: none;
          padding: 16px 36px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          display: inline-block;
        }
        .mf-btn-primary:hover {
          background: #99F6E4;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(94,234,212,0.25);
        }
        .mf-btn-ghost {
          background: transparent;
          color: rgba(226,244,241,0.8);
          border: 1px solid rgba(226,244,241,0.2);
          padding: 15px 28px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
          display: inline-block;
        }
        .mf-btn-ghost:hover {
          border-color: rgba(94,234,212,0.5);
          color: #5EEAD4;
        }
        .mf-hero-stats {
          display: flex;
          gap: 48px;
          margin-top: 72px;
          padding-top: 40px;
          border-top: 1px solid rgba(94,234,212,0.12);
        }
        .mf-stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 32px;
          font-weight: 800;
          color: #5EEAD4;
          display: block;
        }
        .mf-stat-label {
          font-size: 13px;
          color: rgba(226,244,241,0.5);
          margin-top: 4px;
        }

        /* ── REVEAL ANIMATION ── */
        [data-reveal] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .mf-revealed {
          opacity: 1 !important;
          transform: none !important;
        }

        /* ── SECTION BASE ── */
        .mf-section {
          padding: 100px 48px;
        }
        .mf-section-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #5EEAD4;
          margin-bottom: 16px;
        }
        .mf-section-h2 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 4vw, 52px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1.5px;
          color: #E2F4F1;
          margin-bottom: 16px;
        }
        .mf-section-sub {
          font-size: 17px;
          color: rgba(226,244,241,0.55);
          line-height: 1.6;
          max-width: 520px;
          margin-bottom: 64px;
        }
        .mf-max {
          max-width: 1160px;
          margin: 0 auto;
        }

        /* ── HOW IT WORKS ── */
        .mf-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: rgba(94,234,212,0.08);
          border: 1px solid rgba(94,234,212,0.12);
          border-radius: 16px;
          overflow: hidden;
        }
        .mf-step {
          background: rgba(13,59,54,0.95);
          padding: 48px 40px;
          position: relative;
          transition: background 0.2s;
        }
        .mf-step:hover { background: rgba(15,118,110,0.3); }
        .mf-step-num {
          font-family: 'Syne', sans-serif;
          font-size: 64px;
          font-weight: 800;
          color: rgba(94,234,212,0.12);
          line-height: 1;
          margin-bottom: 32px;
          display: block;
        }
        .mf-step-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #E2F4F1;
          margin-bottom: 16px;
        }
        .mf-step-body {
          font-size: 15px;
          color: rgba(226,244,241,0.55);
          line-height: 1.65;
        }

        /* ── MODULES GRID ── */
        .mf-modules-section {
          padding: 100px 48px;
          background: rgba(0,0,0,0.15);
        }
        .mf-modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .mf-module-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 28px 24px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
          text-decoration: none;
          display: block;
        }
        .mf-module-card:hover {
          background: rgba(255,255,255,0.08);
          transform: translateY(-2px);
        }
        .mf-module-card.live {
          border-color: rgba(255,255,255,0.15);
        }
        .mf-module-card.live:hover {
          border-color: rgba(255,255,255,0.25);
        }
        .mf-module-swatch {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mf-module-name {
          font-family: 'Syne', sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: #E2F4F1;
          margin-bottom: 4px;
        }
        .mf-module-tagline {
          font-size: 12px;
          color: rgba(226,244,241,0.45);
        }
        .mf-live-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(94,234,212,0.15);
          border: 1px solid rgba(94,234,212,0.35);
          color: #5EEAD4;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .mf-live-dot {
          width: 5px; height: 5px;
          background: #5EEAD4;
          border-radius: 50%;
          animation: mf-pulse 2s ease-in-out infinite;
        }
        .mf-soon-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(255,255,255,0.06);
          color: rgba(226,244,241,0.35);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          border-radius: 100px;
        }

        /* ── PLATFORM PITCH ── */
        .mf-pitch-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
        }
        .mf-pitch-pills {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mf-pitch-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(94,234,212,0.1);
          border-radius: 12px;
          padding: 24px 28px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
        }
        .mf-pitch-icon {
          width: 40px;
          height: 40px;
          background: rgba(94,234,212,0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 18px;
        }
        .mf-pitch-pill-title {
          font-size: 15px;
          font-weight: 600;
          color: #E2F4F1;
          margin-bottom: 6px;
        }
        .mf-pitch-pill-body {
          font-size: 13px;
          color: rgba(226,244,241,0.5);
          line-height: 1.6;
        }

        /* ── CTA BAND ── */
        .mf-cta-band {
          margin: 0 48px 100px;
          background: linear-gradient(135deg, #0F766E 0%, #0D3B36 100%);
          border: 1px solid rgba(94,234,212,0.2);
          border-radius: 20px;
          padding: 80px 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 40px;
          flex-wrap: wrap;
        }
        .mf-cta-h2 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(32px, 3.5vw, 44px);
          font-weight: 800;
          color: #E2F4F1;
          letter-spacing: -1px;
          line-height: 1.1;
          margin-bottom: 12px;
        }
        .mf-cta-sub {
          font-size: 16px;
          color: rgba(226,244,241,0.6);
        }

        /* ── FOOTER ── */
        .mf-footer {
          border-top: 1px solid rgba(94,234,212,0.1);
          padding: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
        }
        .mf-footer-logo {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: #5EEAD4;
          text-decoration: none;
        }
        .mf-footer-logo span { color: rgba(226,244,241,0.5); }
        .mf-footer-links {
          display: flex;
          gap: 32px;
          list-style: none;
        }
        .mf-footer-links a {
          color: rgba(226,244,241,0.4);
          text-decoration: none;
          font-size: 13px;
          transition: color 0.2s;
        }
        .mf-footer-links a:hover { color: #5EEAD4; }
        .mf-footer-copy {
          font-size: 13px;
          color: rgba(226,244,241,0.25);
        }

        @media (max-width: 768px) {
          .mf-nav { padding: 16px 24px; }
          .mf-nav-links { display: none; }
          .mf-hero { padding: 100px 24px 60px; }
          .mf-section { padding: 72px 24px; }
          .mf-modules-section { padding: 72px 24px; }
          .mf-steps { grid-template-columns: 1fr; }
          .mf-pitch-grid { grid-template-columns: 1fr; }
          .mf-cta-band { margin: 0 24px 72px; padding: 48px 32px; }
          .mf-footer { padding: 32px 24px; flex-direction: column; align-items: flex-start; }
          .mf-modules-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        }
      `}</style>

      <div className="mf-root">
        {/* NAV */}
        <nav className="mf-nav">
          <a href="/" className="mf-nav-logo">Measure<span>Fit</span></a>
          <ul className="mf-nav-links">
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#modules">Modules</a></li>
            <li><a href="#platform">Platform</a></li>
            <li>
              <a href="/signup?vertical=windowfit" className="mf-nav-cta">
                Get started
              </a>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="mf-hero" ref={heroRef}>
          <div className="mf-hero-bg" />
          <div className="mf-hero-grid-lines" />
          <div className="mf-hero-content">
            <div className="mf-hero-eyebrow" data-reveal>
              <span className="mf-hero-eyebrow-dot" />
              AR + LiDAR measurement platform
            </div>
            <h1 className="mf-hero-h1" data-reveal>
              One platform.<br /><em>Every trade.</em>
            </h1>
            <p className="mf-hero-sub" data-reveal>
              MeasureFit gives home improvement dealers the tools to measure precisely,
              quote instantly, and close faster — no matter what they install.
            </p>
            <div className="mf-hero-actions" data-reveal>
              <a href="/signup?vertical=windowfit" className="mf-btn-primary">
                Start with WindowFit →
              </a>
              <a href="#modules" className="mf-btn-ghost">
                See all modules
              </a>
            </div>
            <div className="mf-hero-stats" data-reveal>
              <div>
                <span className="mf-stat-num">14</span>
                <div className="mf-stat-label">Trade verticals</div>
              </div>
              <div>
                <span className="mf-stat-num">1</span>
                <div className="mf-stat-label">Platform to learn</div>
              </div>
              <div>
                <span className="mf-stat-num">AR</span>
                <div className="mf-stat-label">Precision measurement</div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mf-section" id="how-it-works">
          <div className="mf-max">
            <div className="mf-section-label">How it works</div>
            <h2 className="mf-section-h2">From first visit to signed order</h2>
            <p className="mf-section-sub">
              Three steps. Your dealer walks away with perfect measurements and a quote.
              Your customer walks away impressed.
            </p>
            <div className="mf-steps">
              {steps.map((s) => (
                <div className="mf-step" key={s.num}>
                  <span className="mf-step-num">{s.num}</span>
                  <div className="mf-step-title">{s.title}</div>
                  <p className="mf-step-body">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MODULES GRID */}
        <section className="mf-modules-section" id="modules">
          <div className="mf-max">
            <div className="mf-section-label">Modules</div>
            <h2 className="mf-section-h2">Built for every trade</h2>
            <p className="mf-section-sub">
              One login. One workflow. The module your dealer uses determines what they see —
              right product catalog, right terminology, right pricing.
            </p>
            <div className="mf-modules-grid">
              {modules.map((mod) => (
                <a
                  key={mod.name}
                  href={
                    mod.live
                      ? `/signup?vertical=${mod.name.toLowerCase()}`
                      : '#modules'
                  }
                  className={`mf-module-card${mod.live ? ' live' : ''}`}
                  style={
                    mod.live
                      ? { borderColor: `${mod.color}40` }
                      : {}
                  }
                >
                  <div
                    className="mf-module-swatch"
                    style={{ background: `${mod.color}20`, border: `1px solid ${mod.color}40` }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: mod.color,
                        opacity: 0.9,
                      }}
                    />
                  </div>
                  <div className="mf-module-name">{mod.name}</div>
                  <div className="mf-module-tagline">{mod.tagline}</div>
                  {mod.live ? (
                    <span className="mf-live-badge">
                      <span className="mf-live-dot" />
                      Live
                    </span>
                  ) : (
                    <span className="mf-soon-badge">Soon</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* PLATFORM PITCH */}
        <section className="mf-section" id="platform">
          <div className="mf-max">
            <div className="mf-pitch-grid">
              <div>
                <div className="mf-section-label">The platform</div>
                <h2 className="mf-section-h2">One codebase.<br />Every vertical.</h2>
                <p className="mf-section-sub" style={{ marginBottom: 0 }}>
                  MeasureFit isn't a collection of apps. It's a single platform
                  that adapts — same measurements, quotes, and payments engine
                  underneath every module.
                </p>
              </div>
              <div className="mf-pitch-pills">
                {[
                  {
                    icon: '📐',
                    title: 'AR precision measurement',
                    body: 'LiDAR-powered capture on iPhone. Measurements stored with the job, forever.',
                  },
                  {
                    icon: '💬',
                    title: 'Instant branded quotes',
                    body: 'Products, options, and pricing auto-fill. Sent to the customer before you leave.',
                  },
                  {
                    icon: '💳',
                    title: 'Built-in payments',
                    body: 'Stripe-powered deposits and final payments. No separate invoice tool needed.',
                  },
                  {
                    icon: '🏷️',
                    title: 'Your brand, your module',
                    body: 'Each vertical loads its own catalog, color, and terminology automatically.',
                  },
                ].map((p) => (
                  <div className="mf-pitch-pill" key={p.title}>
                    <div className="mf-pitch-icon">{p.icon}</div>
                    <div>
                      <div className="mf-pitch-pill-title">{p.title}</div>
                      <div className="mf-pitch-pill-body">{p.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA BAND */}
        <div className="mf-cta-band">
          <div>
            <h2 className="mf-cta-h2">Ready to measure smarter?</h2>
            <p className="mf-cta-sub">
              WindowFit is live now. Start your free trial today.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/signup?vertical=windowfit" className="mf-btn-primary">
              Get started free →
            </a>
            <a
              href="mailto:hello@windowfit.io"
              className="mf-btn-ghost"
              style={{ borderColor: 'rgba(94,234,212,0.3)', color: 'rgba(226,244,241,0.8)' }}
            >
              Talk to us
            </a>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mf-footer">
          <a href="/" className="mf-footer-logo">
            Measure<span>Fit</span>
          </a>
          <ul className="mf-footer-links">
            <li><a href="https://windowfit.io">WindowFit</a></li>
            <li><a href="/signup">Sign up</a></li>
            <li><a href="mailto:hello@windowfit.io">Contact</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>
          <span className="mf-footer-copy">
            © {new Date().getFullYear()} WindowFit, Inc. All rights reserved.
          </span>
        </footer>
      </div>
    </>
  );
}