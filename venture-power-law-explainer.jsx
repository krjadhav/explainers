import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, ReferenceLine, Area, AreaChart,
  Cell
} from "recharts";

// --- Simulation Engine ---
function powerLawSample(alpha, xmin = 1.0) {
  const u = Math.random();
  return xmin * Math.pow(1 - u, -1 / (alpha - 1));
}

function singleDraw(alpha, pZero, pOne) {
  const r = Math.random();
  if (r < pZero) return 0;
  if (r < pZero + pOne) return 1;
  return powerLawSample(alpha);
}

function simulatePortfolios(alpha, portSize, runs, pZero, pOne) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    let sum = 0;
    for (let j = 0; j < portSize; j++) {
      sum += singleDraw(alpha, pZero, pOne);
    }
    results.push(sum / portSize);
  }
  return results;
}

function computeBenchmarkProbabilities(alpha, portSizes, benchmarks, runs, pZero, pOne) {
  return portSizes.map(n => {
    const results = simulatePortfolios(alpha, n, runs, pZero, pOne);
    const row = { size: n };
    benchmarks.forEach(b => {
      const count = results.filter(r => r >= b).length;
      row[`${b}x`] = Math.round((count / runs) * 1000) / 10;
    });
    return row;
  });
}

function computeHistogram(results, binWidth = 0.5, maxBin = 12) {
  const bins = [];
  for (let i = 0; i <= maxBin; i += binWidth) {
    bins.push({ bin: i, label: `${i.toFixed(1)}x`, count: 0 });
  }
  results.forEach(r => {
    const idx = Math.min(Math.floor(r / binWidth), bins.length - 1);
    if (idx >= 0 && idx < bins.length) bins[idx].count++;
  });
  const total = results.length;
  bins.forEach(b => {
    b.percent = Math.round((b.count / total) * 1000) / 10;
  });
  return bins;
}

// --- Styling ---
const COLORS = {
  bg: "#0a0a0f",
  surface: "#111118",
  surface2: "#1a1a24",
  surface3: "#222230",
  border: "#2a2a3a",
  borderLight: "#3a3a4f",
  text: "#e8e6f0",
  textMuted: "#8a8899",
  textDim: "#5a5870",
  accent: "#f97316",
  accentDim: "#f9731640",
  green: "#22c55e",
  greenDim: "#22c55e30",
  red: "#ef4444",
  redDim: "#ef444430",
  blue: "#3b82f6",
  blueDim: "#3b82f620",
  purple: "#a855f7",
  purpleDim: "#a855f730",
  yellow: "#eab308",
  yellowDim: "#eab30830",
};

const chartColors = [COLORS.green, COLORS.blue, COLORS.purple, COLORS.yellow, COLORS.red];

// --- Components ---
function Slider({ label, value, onChange, min, max, step, suffix = "", description }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
          {label}
        </label>
        <span style={{
          fontSize: 22, fontWeight: 700, color: COLORS.accent,
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}{suffix}
        </span>
      </div>
      {description && <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8, lineHeight: 1.5 }}>{description}</div>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 6, appearance: "none", background: `linear-gradient(to right, ${COLORS.accent} 0%, ${COLORS.accent} ${((value - min) / (max - min)) * 100}%, ${COLORS.surface3} ${((value - min) / (max - min)) * 100}%, ${COLORS.surface3} 100%)`,
          borderRadius: 3, outline: "none", cursor: "pointer",
          accentColor: COLORS.accent,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

function StepHeader({ number, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28, paddingTop: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: COLORS.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: COLORS.bg, fontFamily: "'JetBrains Mono', monospace",
          flexShrink: 0,
        }}>
          {number}
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: COLORS.text, margin: 0, lineHeight: 1.2, fontFamily: "'Space Grotesk', 'Syne', sans-serif", letterSpacing: "-0.02em" }}>
          {title}
        </h2>
      </div>
      {subtitle && <p style={{ fontSize: 15, color: COLORS.textMuted, margin: "0 0 0 52px", lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: 24, marginBottom: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function Callout({ children, type = "info" }) {
  const colors = {
    info: { bg: COLORS.blueDim, border: COLORS.blue, icon: "💡" },
    warning: { bg: COLORS.yellowDim, border: COLORS.yellow, icon: "⚠️" },
    key: { bg: COLORS.accentDim, border: COLORS.accent, icon: "🔑" },
    result: { bg: COLORS.greenDim, border: COLORS.green, icon: "📊" },
  };
  const c = colors[type];
  return (
    <div style={{
      background: c.bg, borderLeft: `3px solid ${c.border}`,
      borderRadius: "0 8px 8px 0", padding: "14px 18px", marginBottom: 20,
      fontSize: 14, lineHeight: 1.7, color: COLORS.text,
    }}>
      <span style={{ marginRight: 8 }}>{c.icon}</span>{children}
    </div>
  );
}

function Prose({ children }) {
  return <p style={{ fontSize: 15, lineHeight: 1.8, color: COLORS.textMuted, marginBottom: 18 }}>{children}</p>;
}

function MathBlock({ children }) {
  return (
    <div style={{
      background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: "12px 18px", marginBottom: 18,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: COLORS.accent,
      overflowX: "auto", lineHeight: 1.8,
    }}>
      {children}
    </div>
  );
}

function SimButton({ onClick, running, label = "Run Simulation" }) {
  return (
    <button
      onClick={onClick}
      disabled={running}
      style={{
        background: running ? COLORS.surface3 : COLORS.accent,
        color: running ? COLORS.textMuted : COLORS.bg,
        border: "none", borderRadius: 8, padding: "12px 28px",
        fontSize: 14, fontWeight: 700, cursor: running ? "wait" : "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.03em",
        transition: "all 0.2s",
        opacity: running ? 0.7 : 1,
      }}
    >
      {running ? "⏳ Simulating..." : `▶ ${label}`}
    </button>
  );
}

// Custom tooltip
function CustomTooltip({ active, payload, label, suffix = "%" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ color: COLORS.textMuted, marginBottom: 6 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}{suffix}
        </div>
      ))}
    </div>
  );
}


export default function App() {
  // Global tweakable parameters
  const [alpha, setAlpha] = useState(1.98);
  const [pZero, setPZero] = useState(0.333);
  const [pOne, setPOne] = useState(0.333);
  const [runs, setRuns] = useState(3000);

  // Step 2: single portfolio histogram
  const [step2PortSize, setStep2PortSize] = useState(20);
  const [step2Data, setStep2Data] = useState(null);
  const [step2Running, setStep2Running] = useState(false);

  // Step 3: benchmark chart
  const [step3Data, setStep3Data] = useState(null);
  const [step3Running, setStep3Running] = useState(false);

  // Step 4: full table
  const [step4Data, setStep4Data] = useState(null);
  const [step4Running, setStep4Running] = useState(false);

  const pTail = Math.max(0, 1 - pZero - pOne);

  // Step 2: histogram sim
  const runStep2 = useCallback(() => {
    setStep2Running(true);
    setTimeout(() => {
      const results = simulatePortfolios(alpha, step2PortSize, runs, pZero, pOne);
      const hist = computeHistogram(results, 0.5, 10);
      const lossCount = results.filter(r => r < 1).length;
      const mean = results.reduce((a, b) => a + b, 0) / results.length;
      const median = [...results].sort((a, b) => a - b)[Math.floor(results.length / 2)];
      setStep2Data({ hist, lossCount, lossPct: ((lossCount / results.length) * 100).toFixed(1), mean: mean.toFixed(2), median: median.toFixed(2), total: results.length });
      setStep2Running(false);
    }, 50);
  }, [alpha, step2PortSize, runs, pZero, pOne]);

  // Step 3: benchmark probability curves
  const runStep3 = useCallback(() => {
    setStep3Running(true);
    setTimeout(() => {
      const sizes = [];
      for (let i = 1; i <= 10; i++) sizes.push(i);
      for (let i = 15; i <= 50; i += 5) sizes.push(i);
      for (let i = 60; i <= 100; i += 10) sizes.push(i);
      sizes.push(150, 200);
      const benchmarks = [1, 2, 3, 5];
      const data = computeBenchmarkProbabilities(alpha, sizes, benchmarks, runs, pZero, pOne);
      setStep3Data(data);
      setStep3Running(false);
    }, 50);
  }, [alpha, runs, pZero, pOne]);

  // Step 4: full table
  const runStep4 = useCallback(() => {
    setStep4Running(true);
    setTimeout(() => {
      const sizes = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200];
      const benchmarks = [1, 2, 3, 4, 5, 8, 10];
      const data = computeBenchmarkProbabilities(alpha, sizes, benchmarks, Math.min(runs, 3000), pZero, pOne);
      setStep4Data(data);
      setStep4Running(false);
    }, 50);
  }, [alpha, runs, pZero, pOne]);

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", color: COLORS.text,
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Hero */}
      <div style={{
        padding: "60px 24px 40px", textAlign: "center",
        background: `radial-gradient(ellipse at 50% 0%, ${COLORS.accentDim} 0%, transparent 60%)`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
          Interactive Explainer
        </div>
        <h1 style={{
          fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, margin: "0 auto 16px",
          maxWidth: 700, lineHeight: 1.15,
          fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em",
          background: `linear-gradient(135deg, ${COLORS.text} 0%, ${COLORS.accent} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Why You Need 50–100 Bets to Make Money in Venture
        </h1>
        <p style={{ fontSize: 16, color: COLORS.textMuted, maxWidth: 550, margin: "0 auto", lineHeight: 1.6 }}>
          An interactive walkthrough of the power-law math behind venture portfolio construction. Tweak every parameter and watch the simulation update live.
        </p>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 14 }}>
          Based on <a href="https://reactionwheel.net/2017/12/power-laws-in-venture-portfolio-construction.html" style={{ color: COLORS.accent, textDecoration: "none" }} target="_blank" rel="noopener">Jerry Neumann's analysis</a>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* ===== CONTROL PANEL ===== */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, paddingTop: 12, paddingBottom: 12, background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
          <details style={{ cursor: "pointer" }}>
            <summary style={{
              fontSize: 13, fontWeight: 700, color: COLORS.accent,
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em",
              listStyle: "none", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 0",
            }}>
              <span style={{ fontSize: 16 }}>⚙</span> GLOBAL PARAMETERS — Click to adjust
              <span style={{
                fontSize: 11, color: COLORS.textDim, fontWeight: 400, marginLeft: "auto",
              }}>
                α={alpha} · P(0x)={(pZero * 100).toFixed(0)}% · P(1x)={((pOne) * 100).toFixed(0)}% · P({">"} 1x)={(pTail * 100).toFixed(0)}% · {runs} runs
              </span>
            </summary>
            <Card style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
                <Slider label="Alpha (α)" value={alpha} onChange={setAlpha} min={1.5} max={2.5} step={0.01}
                  description="Power-law exponent. Below 2 = infinite mean (fat tail). The blog estimates ~1.98." />
                <Slider label="Simulation Runs" value={runs} onChange={setRuns} min={500} max={10000} step={500} suffix=""
                  description="More runs = smoother results, but slower." />
                <Slider label="P(0× return)" value={pZero} onChange={v => { setPZero(v); if (v + pOne > 1) setPOne(Math.max(0, 1 - v)); }} min={0} max={0.8} step={0.01} suffix=""
                  description="Probability of total loss." />
                <Slider label="P(1× return)" value={pOne} onChange={v => { setPOne(v); if (v + pZero > 1) setPZero(Math.max(0, 1 - v)); }} min={0} max={0.8} step={0.01} suffix=""
                  description="Probability of just getting your money back." />
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                P(power-law upside) = <span style={{ color: COLORS.green, fontWeight: 700 }}>{(pTail * 100).toFixed(1)}%</span>
                {pTail <= 0 && <span style={{ color: COLORS.red, marginLeft: 12 }}>⚠ No upside probability — adjust sliders</span>}
              </div>
            </Card>
          </details>
        </div>

        {/* ===== STEP 1: THE MODEL ===== */}
        <StepHeader number={1} title="The Venture Outcome Model" subtitle="What happens to each dollar you invest?" />

        <Prose>
          Every venture investment has three possible fates. Neumann models it as a simple three-way split:
        </Prose>

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, textAlign: "center" }}>
            {[
              { label: "Total Loss", value: `${(pZero * 100).toFixed(0)}%`, sub: "Return: 0×", color: COLORS.red, emoji: "💀" },
              { label: "Break Even", value: `${(pOne * 100).toFixed(0)}%`, sub: "Return: 1×", color: COLORS.yellow, emoji: "😐" },
              { label: "Power-Law Upside", value: `${(pTail * 100).toFixed(0)}%`, sub: "Return: >1× (fat tail)", color: COLORS.green, emoji: "🚀" },
            ].map((item, i) => (
              <div key={i} style={{
                background: COLORS.surface2, borderRadius: 10, padding: "18px 12px",
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{item.emoji}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </Card>

        <Prose>
          The crucial part is the third bucket. When a company <em>does</em> succeed, the returns aren't drawn from a normal bell curve — they follow a <strong>power-law distribution</strong> with exponent α ≈ {alpha}. This means a few outlier investments can return 100×, 1,000×, or even 10,000× your money. The lower α is, the fatter the tail — and when α drops below 2, the theoretical average return becomes <em>infinite</em>.
        </Prose>

        <Callout type="key">
          <strong>This is the core insight:</strong> because α &lt; 2, the expected value of the distribution is mathematically infinite. No finite sample of historical data captures the true mean. You can't just look at past outcomes — you have to model the underlying power law.
        </Callout>

        {/* ===== STEP 2: SINGLE PORTFOLIO ===== */}
        <StepHeader number={2} title="Simulate a Single Portfolio" subtitle="What does a portfolio of N companies actually look like?" />

        <Prose>
          Let's build intuition. Pick a portfolio size below, and we'll simulate {runs.toLocaleString()} random portfolios of that size — each one drawing companies from the distribution above. The histogram shows how often each average return occurs.
        </Prose>

        <Card>
          <Slider label="Portfolio Size" value={step2PortSize} onChange={setStep2PortSize}
            min={1} max={200} step={1} suffix=" companies" />
          <SimButton onClick={runStep2} running={step2Running} label="Run Histogram Simulation" />

          {step2Data && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Lost Money", value: `${step2Data.lossPct}%`, color: COLORS.red },
                  { label: "Mean Return", value: `${step2Data.mean}×`, color: COLORS.accent },
                  { label: "Median Return", value: `${step2Data.median}×`, color: COLORS.blue },
                ].map((s, i) => (
                  <div key={i} style={{ background: COLORS.surface2, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={step2Data.hist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textDim, fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fill: COLORS.textDim, fontSize: 10 }} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x="1.0x" stroke={COLORS.red} strokeDasharray="4 4" label={{ value: "Break even", fill: COLORS.red, fontSize: 10, position: "top" }} />
                  <Bar dataKey="percent" name="Frequency" radius={[4, 4, 0, 0]}>
                    {step2Data.hist.map((entry, idx) => (
                      <Cell key={idx} fill={entry.bin < 1 ? COLORS.red : entry.bin < 2 ? COLORS.yellow : COLORS.green} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8, textAlign: "center" }}>
                Distribution of average portfolio returns across {step2Data.total.toLocaleString()} simulated portfolios of {step2PortSize} companies
              </div>
            </div>
          )}
        </Card>

        <Callout type="info">
          Try it: set portfolio size to 5, then to 50, then to 150. Notice how the histogram tightens — but never fully — around the mean. Unlike normal distributions, power laws make full convergence impossible when α &lt; 2.
        </Callout>

        {/* ===== STEP 3: THE KEY CHART ===== */}
        <StepHeader number={3} title="Probability of Beating Benchmarks" subtitle="This is the chart that reveals the 50–100 sweet spot." />

        <Prose>
          Now we ask the key question: for each portfolio size from 1 to 200, what percentage of simulated portfolios beat a given return benchmark? We track four: making any money (≥1×), doubling (≥2×), tripling (≥3×), and the venture gold standard of 5× or better.
        </Prose>

        <Card>
          <SimButton onClick={runStep3} running={step3Running} label="Run Benchmark Simulation" />

          {step3Data && (
            <div style={{ marginTop: 24 }}>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={step3Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="size" tick={{ fill: COLORS.textDim, fontSize: 11 }} label={{ value: "Portfolio Size", position: "insideBottom", offset: -2, fill: COLORS.textMuted, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.textDim, fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: COLORS.textMuted }} />
                  <ReferenceLine x={50} stroke={COLORS.accent} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "50", fill: COLORS.accent, fontSize: 11, position: "top" }} />
                  <ReferenceLine x={100} stroke={COLORS.accent} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "100", fill: COLORS.accent, fontSize: 11, position: "top" }} />
                  <ReferenceLine y={95} stroke={COLORS.textDim} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="1x" name="≥ 1× (not lose $)" stroke={COLORS.green} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="2x" name="≥ 2× (double)" stroke={COLORS.blue} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="3x" name="≥ 3× (triple)" stroke={COLORS.purple} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="5x" name="≥ 5× (home run)" stroke={COLORS.yellow} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8, textAlign: "center" }}>
                Dashed orange lines mark the 50–100 company range. Gray dashed line = 95% confidence.
              </div>
            </div>
          )}
        </Card>

        <Callout type="result">
          <strong>Reading the chart:</strong> The green line (≥1×) crosses 95% around portfolio size ~50. That's the "safety" threshold — below 50 companies, you have a meaningful chance of losing money. But notice how the higher-return lines (2×, 3×, 5×) climb <em>very slowly</em>. Going from 50 to 100 companies barely moves them. This is the fat-tail effect: certainty is almost impossible to achieve.
        </Callout>

        {/* ===== STEP 4: FULL TABLE ===== */}
        <StepHeader number={4} title="The Full Picture" subtitle="A complete probability table across portfolio sizes and return multiples." />

        <Card>
          <SimButton onClick={runStep4} running={step4Running} label="Generate Full Table" />

          {step4Data && (
            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `2px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Port. Size
                    </th>
                    {["1x", "2x", "3x", "4x", "5x", "8x", "10x"].map(b => (
                      <th key={b} style={{ padding: "10px 8px", textAlign: "right", borderBottom: `2px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase" }}>
                        ≥{b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step4Data.map((row, i) => (
                    <tr key={i} style={{
                      background: (row.size >= 50 && row.size <= 100) ? COLORS.accentDim : "transparent",
                    }}>
                      <td style={{
                        padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`,
                        fontWeight: 700, color: (row.size >= 50 && row.size <= 100) ? COLORS.accent : COLORS.text,
                      }}>
                        {row.size}
                      </td>
                      {["1x", "2x", "3x", "4x", "5x", "8x", "10x"].map(b => {
                        const val = row[b];
                        const color = val >= 95 ? COLORS.green : val >= 50 ? COLORS.blue : val >= 20 ? COLORS.yellow : COLORS.textDim;
                        return (
                          <td key={b} style={{
                            padding: "8px 8px", textAlign: "right", borderBottom: `1px solid ${COLORS.border}`,
                            color, fontWeight: val >= 90 ? 700 : 400,
                          }}>
                            {val.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 10 }}>
                Orange highlighted rows = the 50–100 sweet spot. Green = ≥95%, Blue = ≥50%, Yellow = ≥20%.
              </div>
            </div>
          )}
        </Card>

        {/* ===== STEP 5: CONCLUSION ===== */}
        <StepHeader number={5} title="Why 50–100 Is the Sweet Spot" subtitle="Three forces converge at this range." />

        <Card style={{ background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surface2} 100%)` }}>
          <div style={{ display: "grid", gap: 20 }}>
            {[
              {
                num: "01", title: "Below ~50, you're gambling",
                body: "With fewer than 50 investments, the power-law math gives you a meaningful (>5%) chance of losing money outright. The fat tail means a few unlucky draws can wipe out your whole portfolio.",
                color: COLORS.red,
              },
              {
                num: "02", title: "Above ~100, diversification stalls",
                body: "Because α < 2, the Law of Large Numbers never fully kicks in. Going from 100 to 1,000 companies barely moves the probability needle on higher-return benchmarks. You'd need 100× more bets to double your odds of a 5× return.",
                color: COLORS.yellow,
              },
              {
                num: "03", title: "Active help has diminishing reach",
                body: "Venture investors who actively support their companies improve outcomes. But you can meaningfully help ~50–100 companies, not 500. Beyond this range, the quality of the underlying distribution degrades, offsetting the statistical benefit of more bets.",
                color: COLORS.green,
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: item.color,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: `${item.color}15`, borderRadius: 6, padding: "6px 10px",
                  flexShrink: 0,
                }}>
                  {item.num}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Callout type="key">
          <strong>The punchline:</strong> In a power-law world, there is no portfolio large enough to <em>guarantee</em> great returns. The best you can do is get big enough to avoid catastrophe (~50), stay small enough to add real value (~100), and accept that the rest is up to the fat tail.
        </Callout>

        <div style={{
          textAlign: "center", marginTop: 48, paddingTop: 32,
          borderTop: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.7 }}>
            Based on <a href="https://reactionwheel.net/2017/12/power-laws-in-venture-portfolio-construction.html" style={{ color: COLORS.accent }} target="_blank" rel="noopener">Power Laws in Venture Portfolio Construction</a> by Jerry Neumann (2017)
            <br />
            Simulations run in-browser. Results vary between runs due to random sampling — that's the point.
          </div>
        </div>
      </div>
    </div>
  );
}
