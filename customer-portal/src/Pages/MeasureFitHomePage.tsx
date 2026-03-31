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

export default function MeasureFitHomePage() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('mf-in-view');
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll('[data-animate]').forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mf-root {
          font-family: 'Outfit', sans-serif;
          color: #111;
          overflow-x: hidden;
        }

        [data-animate] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        [data-animate].mf-in-view { opacity: 1; transform: none; }
        [data-animate-delay="1"] { transition-delay: 0.1s; }
        [data-animate-delay="2"] { transition-delay: 0.2s; }
        [data-animate-delay="3"] { transition-delay: 0.3s; }
        [data-animate-delay="4"] { transition-delay: 0.4s; }

        /* ── NAV ── */
        .mf-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 52px; height: 68px;
          background: rgba(10,46,42,0.97);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mf-nav-logo {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 18px; font-weight: 800; letter-spacing: -0.5px;
          color: #fff; text-decoration: none;
        }
        .mf-nav-logo .accent { color: #5EEAD4; }
        .mf-nav-links { display: flex; align-items: center; gap: 36px; list-style: none; }
        .mf-nav-links a {
          color: rgba(255,255,255,0.55); text-decoration: none;
          font-size: 14px; font-weight: 500; transition: color 0.2s;
        }
        .mf-nav-links a:hover { color: #fff; }

        /* FIX 1: Nav CTA — solid teal fill, high contrast, impossible to miss */
        .mf-nav-cta {
          background: #5EEAD4;
          color: #0A2E2A !important;
          border: none;
          padding: 9px 22px; border-radius: 8px;
          font-size: 14px; font-weight: 700;
          font-family: 'Outfit', sans-serif;
          text-decoration: none; display: inline-block;
          letter-spacing: 0.1px;
          transition: background 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 0 3px rgba(94,234,212,0.25);
        }
        .mf-nav-cta:hover {
          background: #99F6E4;
          color: #0A2E2A !important;
          box-shadow: 0 0 0 4px rgba(94,234,212,0.35);
        }

        /* ── HERO ── */
        .mf-hero {
          background: #0A2E2A;
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 120px 48px 100px;
          position: relative; overflow: hidden;
        }
        .mf-hero::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 50% -5%, rgba(15,118,110,0.55) 0%, transparent 65%),
            radial-gradient(ellipse 40% 35% at 15% 90%, rgba(94,234,212,0.06) 0%, transparent 55%);
          pointer-events: none;
        }
        .mf-hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(94,234,212,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(94,234,212,0.025) 1px, transparent 1px);
          background-size: 72px 72px; pointer-events: none;
        }
        .mf-hero-inner { position: relative; max-width: 800px; }

        /* FIX 2: Eyebrow — removed orphaned dot, now uses a pill with inline indicator */
        .mf-eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(94,234,212,0.08);
          border: 1px solid rgba(94,234,212,0.18);
          color: #5EEAD4; font-size: 11px; font-weight: 600;
          letter-spacing: 2px; text-transform: uppercase;
          padding: 7px 18px 7px 14px; border-radius: 100px; margin-bottom: 40px;
        }
        .mf-eyebrow-pip {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(94,234,212,0.15);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .mf-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #5EEAD4;
          animation: mf-blink 2.5s ease-in-out infinite;
        }
        @keyframes mf-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

        .mf-hero-h1 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(52px, 7.5vw, 88px);
          font-weight: 800; line-height: 1.0; letter-spacing: -2.5px;
          color: #fff;
        }
        .mf-hero-h1 .line2 {
          display: block; color: #5EEAD4;
        }
        .mf-hero-sub {
          font-size: 18px; line-height: 1.7; font-weight: 400;
          color: rgba(255,255,255,0.45);
          max-width: 480px; margin: 30px auto 48px;
        }
        .mf-hero-actions {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap;
        }
        .mf-btn-primary {
          background: #5EEAD4; color: #0A2E2A;
          border: none; padding: 14px 32px; border-radius: 8px;
          font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: 'Outfit', sans-serif;
          text-decoration: none; display: inline-block;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .mf-btn-primary:hover {
          background: #99F6E4; transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(94,234,212,0.25);
        }
        .mf-btn-ghost {
          background: transparent; color: rgba(255,255,255,0.65);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 13px 28px; border-radius: 8px;
          font-size: 15px; font-weight: 500;
          cursor: pointer; font-family: 'Outfit', sans-serif;
          text-decoration: none; display: inline-block;
          transition: border-color 0.2s, color 0.2s;
        }
        .mf-btn-ghost:hover { border-color: rgba(255,255,255,0.35); color: #fff; }

        /* FIX 3: All stats white, accent only on the teal line */
        .mf-hero-stats {
          display: flex; justify-content: center; gap: 60px;
          margin-top: 80px; padding-top: 44px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .mf-stat-num {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 32px; font-weight: 800; letter-spacing: -1px;
          color: #fff; display: block; line-height: 1;
        }
        .mf-stat-label {
          font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 7px;
          text-transform: uppercase; letter-spacing: 1px; font-weight: 500;
        }

        /* FIX 4: Trust bar — card-style chips instead of inline pipe-separated text */
        .mf-trust {
          background: #F0FDF9;
          border-bottom: 1px solid #CCFBF1;
          padding: 20px 52px;
          display: flex; align-items: center; justify-content: center;
          gap: 10px; flex-wrap: wrap;
        }
        .mf-trust-chip {
          display: inline-flex; align-items: center; gap: 7px;
          background: #fff;
          border: 1px solid #A7F3D0;
          color: #065F46;
          font-size: 13px; font-weight: 500;
          padding: 8px 16px; border-radius: 100px;
          white-space: nowrap;
        }
        .mf-trust-chip-icon {
          width: 18px; height: 18px; border-radius: 50%;
          background: #D1FAF0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; flex-shrink: 0; color: #065F46; font-weight: 700;
        }

        /* ── SHARED SECTION STYLES ── */
        .mf-section-white { background: #fff; padding: 100px 52px; }
        .mf-section-offwhite { background: #FAFAFA; padding: 100px 52px; }
        .mf-modules-bg {
          background: #F0FDF9; padding: 100px 52px;
          border-top: 1px solid #CCFBF1; border-bottom: 1px solid #CCFBF1;
        }
        .mf-max { max-width: 1120px; margin: 0 auto; }

        .mf-tag {
          display: inline-block; font-size: 11px; font-weight: 700;
          letter-spacing: 2px; text-transform: uppercase; color: #0F766E;
          margin-bottom: 14px;
        }
        .mf-h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(32px, 4vw, 46px); font-weight: 800;
          line-height: 1.1; letter-spacing: -1.5px; color: #0A2E2A;
          margin-bottom: 14px;
        }
        .mf-lead {
          font-size: 16px; color: #6B7280; line-height: 1.7; max-width: 480px;
        }

        /* ── STEPS ── */
        .mf-steps { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 52px; }
        .mf-step {
          background: #FAFFFE; border: 1px solid #D1FAF0;
          border-radius: 14px; padding: 36px 32px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .mf-step:hover { border-color: #5EEAD4; box-shadow: 0 4px 20px rgba(94,234,212,0.12); }

        /* FIX 5: Step numbers — darker, more readable */
        .mf-step-num {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 48px; font-weight: 800;
          color: #99F6E4;
          line-height: 1; margin-bottom: 24px; letter-spacing: -2px;
        }
        .mf-step-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 18px; font-weight: 700; color: #0A2E2A; margin-bottom: 10px;
          letter-spacing: -0.3px;
        }
        .mf-step-body { font-size: 14px; color: #6B7280; line-height: 1.7; }

        /* ── BENTO ── */
        .mf-bento { display: grid; grid-template-columns: repeat(12,1fr); gap: 14px; margin-top: 52px; }
        .mf-bc {
          background: #fff; border: 1px solid #E5E7EB;
          border-radius: 14px; padding: 32px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .mf-bc:hover { border-color: #A7F3D0; box-shadow: 0 4px 18px rgba(13,59,54,0.05); }
        .mf-bc.s7 { grid-column: span 7; }
        .mf-bc.s5 { grid-column: span 5; }
        .mf-bc.s4 { grid-column: span 4; }
        .mf-bc.dark { background: #0A2E2A; border-color: #0A2E2A; }
        .mf-bc.dark:hover { border-color: #0F766E; }
        .mf-bc-icon {
          width: 44px; height: 44px; background: #F0FDF9;
          border: 1px solid #CCFBF1; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 20px;
        }
        .mf-bc.dark .mf-bc-icon { background: rgba(94,234,212,0.08); border-color: rgba(94,234,212,0.15); }
        .mf-bc-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 18px; font-weight: 700; color: #0A2E2A;
          margin-bottom: 8px; letter-spacing: -0.3px;
        }
        .mf-bc.dark .mf-bc-title { color: #5EEAD4; }
        .mf-bc-body { font-size: 14px; color: #6B7280; line-height: 1.7; }
        .mf-bc.dark .mf-bc-body { color: rgba(255,255,255,0.45); }
        .mf-bc-big {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 44px; font-weight: 800; color: #5EEAD4;
          line-height: 1; margin-top: 24px; letter-spacing: -2px;
        }
        .mf-bc-big-label {
          font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 4px;
          font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px;
        }

        /* ── MODULES ── */
        .mf-mgrid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr));
          gap: 10px; margin-top: 52px;
        }
        .mf-mcard {
          background: #fff; border: 1px solid #E5E7EB; border-radius: 12px;
          padding: 20px 18px; text-decoration: none; display: block; position: relative;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
        }
        .mf-mcard:hover { box-shadow: 0 4px 16px rgba(13,59,54,0.08); transform: translateY(-2px); }
        .mf-mcard.live { border-color: #D1FAF0; }
        .mf-mswatch { width: 28px; height: 28px; border-radius: 7px; margin-bottom: 14px; }
        .mf-mname {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 2px; letter-spacing: -0.2px;
        }
        .mf-mtag { font-size: 11px; color: #9CA3AF; }
        .mf-live-badge {
          position: absolute; top: 11px; right: 11px;
          background: #F0FDF9; border: 1px solid #A7F3D0; color: #0F766E;
          font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
          padding: 2px 7px; border-radius: 100px; display: flex; align-items: center; gap: 4px;
        }
        .mf-live-dot {
          width: 4px; height: 4px; background: #10B981; border-radius: 50%;
          animation: mf-blink 2.5s ease-in-out infinite;
        }
        .mf-soon-badge {
          position: absolute; top: 11px; right: 11px; background: #F9FAFB;
          color: #D1D5DB; font-size: 9px; font-weight: 500; padding: 2px 7px; border-radius: 100px;
        }

        /* ── CTA ── */
        .mf-cta {
          background: #0A2E2A; padding: 120px 52px; text-align: center;
          position: relative; overflow: hidden;
        }
        .mf-cta::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse 55% 70% at 50% 110%, rgba(15,118,110,0.5) 0%, transparent 60%);
          pointer-events: none;
        }
        .mf-cta-inner { position: relative; max-width: 560px; margin: 0 auto; }
        .mf-cta-h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(34px, 4.5vw, 52px); font-weight: 800;
          color: #fff; letter-spacing: -1.5px; line-height: 1.08; margin-bottom: 18px;
        }
        .mf-cta-sub { font-size: 16px; color: rgba(255,255,255,0.45); margin-bottom: 40px; line-height: 1.65; }
        .mf-cta-row { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }

        /* ── FOOTER ── */
        .mf-footer {
          background: #061A18; padding: 40px 52px;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 20px; border-top: 1px solid rgba(255,255,255,0.05);
        }
        .mf-flogo {
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800;
          color: #fff; text-decoration: none; letter-spacing: -0.3px;
        }
        .mf-flogo .accent { color: #5EEAD4; }
        .mf-flinks { display: flex; gap: 28px; list-style: none; }
        .mf-flinks a { color: rgba(255,255,255,0.28); text-decoration: none; font-size: 13px; transition: color 0.2s; }
        .mf-flinks a:hover { color: rgba(255,255,255,0.7); }
        .mf-fcopy { font-size: 12px; color: rgba(255,255,255,0.18); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .mf-nav { padding: 0 24px; }
          .mf-nav-links li:not(:last-child) { display: none; }
          .mf-hero, .mf-section-white, .mf-section-offwhite,
          .mf-modules-bg, .mf-cta { padding-left: 24px; padding-right: 24px; }
          .mf-steps { grid-template-columns: 1fr; }
          .mf-bc.s7, .mf-bc.s5, .mf-bc.s4 { grid-column: span 12; }
          .mf-hero-stats { gap: 28px; }
          .mf-trust { padding: 16px 24px; }
          .mf-footer { padding: 28px 24px; flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="mf-root">

        {/* NAV */}
        <nav className="mf-nav">
          <a href="/" className="mf-nav-logo">
            Measure<span className="accent">Fit</span>
          </a>
          <ul className="mf-nav-links">
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#platform">Platform</a></li>
            <li><a href="#modules">Modules</a></li>
            <li>
              <a href="/signup?vertical=windowfit" className="mf-nav-cta">
                Get started
              </a>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="mf-hero">
          <div className="mf-hero-grid" />
          <div className="mf-hero-inner">
            {/* FIX: Eyebrow pill now has a proper contained indicator, no orphaned dot */}
            <div className="mf-eyebrow">
              <span className="mf-eyebrow-pip">
                <span className="mf-eyebrow-dot" />
              </span>
              AR + LiDAR Measurement Platform
            </div>
            <h1 className="mf-hero-h1">
              One platform.
              <span className="line2">Every trade.</span>
            </h1>
            <p className="mf-hero-sub">
              MeasureFit gives home improvement dealers AR-powered measurement,
              instant quoting, and built-in payments — all in one app.
            </p>
            <div className="mf-hero-actions">
              <a href="/signup?vertical=windowfit" className="mf-btn-primary">
                Start with WindowFit →
              </a>
              <a href="#how-it-works" className="mf-btn-ghost">
                See how it works
              </a>
            </div>
            {/* FIX: All stat numbers are white — no teal on individual stats */}
            <div className="mf-hero-stats">
              <div>
                <span className="mf-stat-num">14</span>
                <div className="mf-stat-label">Trade verticals</div>
              </div>
              <div>
                <span className="mf-stat-num">1</span>
                <div className="mf-stat-label">Platform to learn</div>
              </div>
              <div>
                <span className="mf-stat-num">±⅛″</span>
                <div className="mf-stat-label">AR accuracy</div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR — chip style */}
        <div className="mf-trust">
          {[
            'No tape measure needed',
            'Quote before you leave',
            'Stripe-powered payments',
            'Works on any iPhone',
            'All from your phone',
          ].map((item) => (
            <span className="mf-trust-chip" key={item}>
              <span className="mf-trust-chip-icon">✓</span>
              {item}
            </span>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <section className="mf-section-white" id="how-it-works">
          <div className="mf-max">
            <div data-animate>
              <span className="mf-tag">How it works</span>
              <h2 className="mf-h2">From front door<br />to signed order.</h2>
              {/* FIX: Added "All from your phone." */}
              <p className="mf-lead">Three steps. Perfect measurements. A quote sent before the visit is over. All from your phone.</p>
            </div>
            <div className="mf-steps">
              {[
                {
                  num: '01',
                  title: 'Scan the space',
                  // FIX: "in seconds" instead of "under 60 seconds", "ready to close" at end
                  body: 'Open the app and point your phone at the space. AR + LiDAR captures exact measurements in seconds — no tape measure, no callbacks, no disputes.',
                },
                {
                  num: '02',
                  title: 'Build the quote',
                  body: 'Products, options, and pricing auto-fill from your catalog. A polished quote is assembled and sent to the customer before you leave their home.',
                },
                {
                  num: '03',
                  title: 'Collect & close',
                  // FIX: Last 3 words changed to "ready to close"
                  body: 'The customer reviews, signs, and pays a deposit online. Your dealer gets the confirmed order with every measurement attached — ready to close.',
                },
              ].map((s, i) => (
                <div className="mf-step" key={s.num} data-animate data-animate-delay={String(i + 1)}>
                  <div className="mf-step-num">{s.num}</div>
                  <div className="mf-step-title">{s.title}</div>
                  <p className="mf-step-body">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLATFORM BENTO */}
        <section className="mf-section-offwhite" id="platform">
          <div className="mf-max">
            <div data-animate>
              <span className="mf-tag">The platform</span>
              <h2 className="mf-h2">Everything a dealer needs.<br />Nothing they don't.</h2>
              <p className="mf-lead">One codebase. One backend. One login. The module determines what your dealer sees.</p>
            </div>
            <div className="mf-bento">
              <div className="mf-bc dark s7" data-animate data-animate-delay="1">
                <div className="mf-bc-icon">📐</div>
                <div className="mf-bc-title">AR precision measurement</div>
                <p className="mf-bc-body">LiDAR-powered capture on iPhone. Measurements stored with the job permanently — no re-measuring, no disputes with customers.</p>
                <div className="mf-bc-big">±⅛″</div>
                <div className="mf-bc-big-label">Measurement accuracy</div>
              </div>
              <div className="mf-bc s5" data-animate data-animate-delay="2">
                <div className="mf-bc-icon">💬</div>
                <div className="mf-bc-title">Instant branded quotes</div>
                <p className="mf-bc-body">Products and pricing auto-fill from your catalog. A polished quote is emailed to the customer before you're back in your truck.</p>
              </div>
              <div className="mf-bc s4" data-animate data-animate-delay="1">
                <div className="mf-bc-icon">💳</div>
                <div className="mf-bc-title">Built-in payments</div>
                <p className="mf-bc-body">Stripe-powered deposits and final payments. No separate invoicing tool, no chasing checks.</p>
              </div>
              <div className="mf-bc s4" data-animate data-animate-delay="2">
                <div className="mf-bc-icon">🏷️</div>
                <div className="mf-bc-title">Multi-vertical modules</div>
                <p className="mf-bc-body">Assign a dealer to WindowFit, FloorFit, or any vertical. The right catalog loads automatically on login.</p>
              </div>
              <div className="mf-bc s4" data-animate data-animate-delay="3">
                <div className="mf-bc-icon">📦</div>
                <div className="mf-bc-title">Product catalog</div>
                <p className="mf-bc-body">62+ products seeded for WindowFit. Brands, colors, fabrics, and options — configured out of the box.</p>
              </div>
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section className="mf-modules-bg" id="modules">
          <div className="mf-max">
            <div data-animate>
              <span className="mf-tag">Modules</span>
              <h2 className="mf-h2">Built for every trade.</h2>
              <p className="mf-lead">WindowFit is live now. More verticals coming — same platform, same workflow, new catalog.</p>
            </div>
            <div className="mf-mgrid">
              {modules.map((mod, i) => (
                <a
                  key={mod.name}
                  href={mod.live ? `/signup?vertical=${mod.name.toLowerCase()}` : '#modules'}
                  className={`mf-mcard${mod.live ? ' live' : ''}`}
                  data-animate
                  data-animate-delay={String((i % 4) + 1)}
                  style={mod.live ? { borderColor: `${mod.color}35` } : {}}
                >
                  <div className="mf-mswatch" style={{ background: mod.color }} />
                  <div className="mf-mname">{mod.name}</div>
                  <div className="mf-mtag">{mod.tagline}</div>
                  {mod.live
                    ? <span className="mf-live-badge"><span className="mf-live-dot" />Live</span>
                    : <span className="mf-soon-badge">Soon</span>
                  }
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mf-cta">
          <div className="mf-cta-inner">
            <div data-animate>
              <h2 className="mf-cta-h2">Ready to measure smarter?</h2>
              <p className="mf-cta-sub">WindowFit is live and taking dealers today. Start your free trial — no credit card required.</p>
              <div className="mf-cta-row">
                <a href="/signup?vertical=windowfit" className="mf-btn-primary">Get started free →</a>
                <a href="mailto:hello@windowfit.io" className="mf-btn-ghost">Talk to us</a>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mf-footer">
          <a href="/" className="mf-flogo">Measure<span className="accent">Fit</span></a>
          <ul className="mf-flinks">
            <li><a href="https://windowfit.io">WindowFit</a></li>
            <li><a href="/signup">Sign up</a></li>
            <li><a href="mailto:hello@windowfit.io">Contact</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>
          <span className="mf-fcopy">© {new Date().getFullYear()} WindowFit, Inc.</span>
        </footer>

      </div>
    </>
  );
}