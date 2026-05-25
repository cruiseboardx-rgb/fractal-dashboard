import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// MOCK DATA — מדמה את הפלט מהאלגוריתם
// ═══════════════════════════════════════════════════════════════
const DATA = {
  ticker: "BTC-USD",
  price: 77234.48,
  marketState: "TRANSITION",
  sync: { pct: 85.6, label: "ALIGNED" },
  timeframes: [
    { tf: "1mo", direction: -1, strength: 0.82, momentum: -0.12, structure: "HH-HL", control: "SELLERS_FADING",   weight: 32, groupLevel: 0 },
    { tf: "1wk", direction: -1, strength: 0.71, momentum:  0.08, structure: "RANGE",  control: "SELLERS_FADING",   weight: 16, groupLevel: 0 },
    { tf: "1d",  direction: -1, strength: 0.94, momentum: -0.09, structure: "HH-HL",  control: "SELLERS_FADING",   weight:  8, groupLevel: 0 },
    { tf: "4h",  direction:  1, strength: 1.23, momentum:  0.15, structure: "RANGE",  control: "BUYERS_DEFENDING", weight:  4, groupLevel: 1 },
    { tf: "1h",  direction:  1, strength: 1.08, momentum:  0.11, structure: "RANGE",  control: "BUYERS_DEFENDING", weight:  2, groupLevel: 1 },
    { tf: "15m", direction:  1, strength: 0.91, momentum:  0.07, structure: "RANGE",  control: "BUYERS_DEFENDING", weight:  1, groupLevel: 1 },
    { tf: "5m",  direction: -1, strength: 0.63, momentum: -0.08, structure: "HH-HL",  control: "SELLERS_FADING",   weight: 0.5, groupLevel: 2 },
  ],
  groups: [
    { direction: -1, tfs: ["1mo","1wk","1d"], label: "MACRO WAVE",  surfDesc: "גל הכיוון הדומיננטי — אל תתנגד לו", level: 0 },
    { direction:  1, tfs: ["4h","1h","15m"],  label: "CORRECTION",  surfDesc: "גל נגד — תיקון על הגל המקרו", level: 1 },
    { direction: -1, tfs: ["5m"],             label: "RESUMPTION",  surfDesc: "חזרת הגל הדומיננטי — כניסה פוטנציאלית", level: 2 },
  ],
  story: [
    "גל מקרו BEARISH דומיננטי — מוכרים שולטים בטווחים הגבוהים",
    "תיקון BULLISH פעיל — קונים הצילו את הרמה הנוכחית",
    "גל BEARISH מתחיל להתגבש ב-5m — סימן לחזרת הכיוון",
    "מומנטום חוזר לצד הדומיננטי — הזדמנות SETUP",
  ],
};

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════
const col = {
  bear:    "#f43f5e",
  bull:    "#10b981",
  neutral: "#f59e0b",
  info:    "#38bdf8",
  bg:      "#06101c",
  bg2:     "#0b1929",
  bg3:     "#0f2035",
  border:  "#1a3150",
  text:    "#e2e8f0",
  muted:   "#7a9ab8",
  dim:     "#3d5a78",
  mono:    "'Courier New', Courier, monospace",
};

const SYNC_THRESHOLDS = [
  { label: "NOISE",    range: "< 55%",  color: col.bear,    min: 0,  max: 55  },
  { label: "BUILDING", range: "55–75%", color: col.neutral,  min: 55, max: 75  },
  { label: "ALIGNED",  range: "75–92%", color: col.info,     min: 75, max: 92  },
  { label: "MATURE",   range: "> 92%",  color: col.bull,     min: 92, max: 100 },
];

const STATE_META = {
  "TRANSITION":   { color: col.neutral, icon: "⏳", en: "Wave structure changing",       action: "Watch for resumption signal"   },
  "ACCUMULATION": { color: col.info,    icon: "📦", en: "Bear macro, bull micro",         action: "Smart money may be buying"     },
  "DISTRIBUTION": { color: "#a855f7",   icon: "📤", en: "Bull macro, bear micro",         action: "Smart money may be selling"    },
  "IGNITION":     { color: "#f97316",   icon: "⚡", en: "Counter-wave at 5m sparked",     action: "Possible wave launch — alert"  },
  "FULL TREND":   { color: col.bull,    icon: "🏄", en: "All timeframes aligned",         action: "Ride the dominant wave"        },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const dirCol = (d) => d > 0 ? col.bull : col.bear;
const dirLabel = (d) => d > 0 ? "BULL" : "BEAR";

function getMomentum(m) {
  if (m >  0.05) return { label: "ACCEL",  symbol: "↗", color: col.bull };
  if (m < -0.05) return { label: "FADING", symbol: "↘", color: col.bear };
  return               { label: "FLAT",   symbol: "→", color: col.neutral };
}

function getControl(ctrl, dir) {
  const strong = ctrl.includes("IN_CONTROL");
  const isB = dir > 0;
  return {
    side:   isB ? "BUYERS" : "SELLERS",
    label:  strong ? "IN CONTROL" : (isB ? "DEFENDING" : "FADING"),
    color:  isB ? (strong ? col.bull : "#34d399") : (strong ? col.bear : "#fca5a5"),
    strong,
  };
}

function getStructure(s) {
  if (s === "HH-HL") return { label: "HH-HL ↑", color: col.bull };
  if (s === "LH-LL") return { label: "LH-LL ↓", color: col.bear };
  return                    { label: "RANGING",  color: col.neutral };
}

// ═══════════════════════════════════════════════════════════════
// WAVE VISUALIZATION SVG
// ═══════════════════════════════════════════════════════════════
function WaveCanvas({ groups }) {
  const W = 800, H = 190;

  function wavePath(x1, x2, yBase, amp, dir, cycles, phase = 0) {
    const pts = [];
    const n = Math.ceil((x2 - x1) / 3);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = t * Math.PI * 2 * cycles + phase;
      const trend = -dir * t * amp * 0.55;
      const y = yBase + trend + amp * Math.sin(ang);
      pts.push(`${(x1 + t * (x2 - x1)).toFixed(1)},${y.toFixed(1)}`);
    }
    return "M " + pts.join(" L ");
  }

  const macroPath = wavePath(20, W - 20, 88, 38, -1, 2.4, 0);
  const corrPath  = wavePath(110, W - 100, 76, 22,  1, 3.2, Math.PI * 0.8);
  const resPath   = wavePath(W - 140, W - 20, 84, 13, -1, 1.8, 0.3);

  const gridYs = [H * 0.2, H * 0.4, H * 0.6, H * 0.8];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}>

      {gridYs.map((y, i) => (
        <line key={i} x1="0" y1={y} x2={W} y2={y}
          stroke={col.dim} strokeWidth="0.5" strokeDasharray="2,14" opacity="0.5" />
      ))}

      {/* Macro area fill */}
      <path d={`${macroPath} L ${W-20},${H} L 20,${H} Z`}
        fill={col.bear} fillOpacity="0.05" />
      <path d={macroPath} fill="none" stroke={col.bear} strokeWidth="2.8" opacity="0.85" />

      {/* Correction fill */}
      <path d={`${corrPath} L ${W-100},${H} L 110,${H} Z`}
        fill={col.bull} fillOpacity="0.07" />
      <path d={corrPath} fill="none" stroke={col.bull} strokeWidth="2.2" opacity="0.82" />

      {/* Resumption dashed */}
      <path d={resPath} fill="none" stroke={col.bear}
        strokeWidth="1.8" strokeDasharray="5,3" opacity="0.72" />

      {/* Pulsing NOW dot */}
      <circle cx={W - 22} cy={88} r="5" fill={col.bear} opacity="0.9">
        <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <text x={W - 13} y={84} fill={col.muted} fontSize="9" fontFamily={col.mono}>NOW</text>

      {/* Wave group labels */}
      {[
        { x: 24, color: col.bear, title: "MACRO WAVE", sub: "1mo · 1wk · 1d" },
        { x: W/2 - 56, color: col.bull, title: "CORRECTION", sub: "4h · 1h · 15m" },
        { x: W - 148, color: col.bear, title: "RESUMPTION", sub: "5m" },
      ].map((g, i) => (
        <g key={i}>
          <text x={g.x} y={18} fill={g.color} fontSize="11" fontFamily={col.mono} fontWeight="700">{g.title}</text>
          <text x={g.x} y={32} fill={g.color} fontSize="9"  fontFamily={col.mono} opacity="0.6">{g.sub}</text>
        </g>
      ))}

      {/* Time axis */}
      <text x={W/2} y={H - 5} fill={col.dim} fontSize="9"
        fontFamily={col.mono} textAnchor="middle">
        WAVE STRUCTURE · TIME →
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// STRENGTH BAR
// ═══════════════════════════════════════════════════════════════
function StrengthBar({ strength, dir }) {
  const pct = Math.min((strength / 3) * 100, 100);
  const c = dirCol(dir);
  const strong = strength >= 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{
        position: "relative", width: "60px", height: "6px",
        background: col.border, borderRadius: "3px", overflow: "visible",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: c, borderRadius: "3px",
        }} />
        {/* Threshold marker at 33% = strength 1.0 */}
        <div style={{
          position: "absolute", left: "33%", top: "-3px",
          width: "1.5px", height: "12px",
          background: col.dim, opacity: 0.6,
        }} />
      </div>
      <span style={{
        fontFamily: col.mono, fontSize: "11px",
        color: strong ? c : col.muted, fontWeight: strong ? "700" : "400",
      }}>
        {strength.toFixed(2)}
      </span>
      {strong && (
        <span style={{
          fontSize: "9px", color: c,
          background: `${c}25`, padding: "1px 4px",
          borderRadius: "3px", fontFamily: col.mono,
        }}>✓</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TF ROW
// ═══════════════════════════════════════════════════════════════
function TFRow({ tf }) {
  const mom  = getMomentum(tf.momentum);
  const ctrl = getControl(tf.control, tf.direction);
  const str  = getStructure(tf.structure);
  const c    = dirCol(tf.direction);
  const side = dirLabel(tf.direction);

  const groupBg     = [col.bear, col.bull, col.bear][tf.groupLevel];
  const groupBorder = `${groupBg}40`;

  // Pressure ≈ |direction * strength * |momentum||
  const pressure = (tf.strength * Math.abs(tf.momentum)).toFixed(3);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "44px 50px 100px 90px 90px 130px 44px 54px",
      gap: "8px",
      alignItems: "center",
      padding: "9px 16px",
      background: `${groupBg}09`,
      borderLeft: `3px solid ${groupBg}45`,
      borderBottom: `1px solid ${col.border}`,
    }}>
      {/* TF */}
      <span style={{ color: col.text, fontFamily: col.mono, fontSize: "13px", fontWeight: "700" }}>
        {tf.tf}
      </span>

      {/* SIDE badge */}
      <span style={{
        color: c, fontFamily: col.mono, fontSize: "11px", fontWeight: "700",
        background: `${c}20`, padding: "3px 6px",
        border: `1px solid ${c}40`, borderRadius: "5px",
        textAlign: "center",
      }}>
        {side}
      </span>

      {/* STRENGTH bar */}
      <StrengthBar strength={tf.strength} dir={tf.direction} />

      {/* MOMENTUM */}
      <span style={{ color: mom.color, fontFamily: col.mono, fontSize: "11px" }}>
        {mom.symbol} {mom.label}
      </span>

      {/* STRUCTURE */}
      <span style={{ color: str.color, fontFamily: col.mono, fontSize: "11px" }}>
        {str.label}
      </span>

      {/* CONTROL */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span style={{
          color: ctrl.color, fontFamily: col.mono, fontSize: "11px",
          fontWeight: ctrl.strong ? "700" : "400",
        }}>
          {ctrl.side}
        </span>
        <span style={{ color: ctrl.color, fontFamily: col.mono, fontSize: "10px", opacity: 0.75 }}>
          {ctrl.label}
        </span>
      </div>

      {/* WEIGHT */}
      <span style={{
        color: col.muted, fontFamily: col.mono, fontSize: "10px",
        background: col.bg3, padding: "2px 5px",
        borderRadius: "4px", textAlign: "center",
      }}>
        ×{tf.weight}
      </span>

      {/* PRESSURE */}
      <span style={{
        color: Math.abs(tf.momentum) > 0.05 ? c : col.dim,
        fontFamily: col.mono, fontSize: "10px", textAlign: "right",
      }}>
        {pressure}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SYNC GAUGE (half-circle arc)
// ═══════════════════════════════════════════════════════════════
function SyncGauge({ pct, label }) {
  const color = pct > 90 ? col.bull : pct > 75 ? col.info : col.neutral;
  const R = 44, cx = 60, cy = 58;
  const arc = Math.PI * R;
  const filled = (pct / 100) * arc;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width="120" height="68" viewBox="0 0 120 68">
        <path d={`M ${cx - R},${cy} A ${R} ${R} 0 0 1 ${cx + R},${cy}`}
          fill="none" stroke={col.border} strokeWidth="7" strokeLinecap="round" />
        <path d={`M ${cx - R},${cy} A ${R} ${R} 0 0 1 ${cx + R},${cy}`}
          fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`} />
        <text x={cx} y={cy - 3} textAnchor="middle" fill={col.text}
          fontSize="22" fontFamily={col.mono} fontWeight="700">{pct.toFixed(0)}%</text>
      </svg>
      <div style={{
        color, fontFamily: col.mono, fontSize: "12px",
        fontWeight: "700", marginTop: "-8px",
      }}>{label}</div>
      <div style={{
        color: col.dim, fontFamily: col.mono,
        fontSize: "9px", letterSpacing: "1.5px", marginTop: "4px",
      }}>FRACTAL SYNC</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEIGHTED SYNC BREAKDOWN
// ═══════════════════════════════════════════════════════════════
function WeightedSync({ timeframes }) {
  const totalPow = timeframes.reduce((s, t) => s + t.weight * Math.max(t.strength, 0.1), 0);
  const bearPow  = timeframes.filter(t => t.direction < 0).reduce((s, t) => s + t.weight * Math.max(t.strength, 0.1), 0);
  const bullPow  = timeframes.filter(t => t.direction > 0).reduce((s, t) => s + t.weight * Math.max(t.strength, 0.1), 0);
  const bearPct  = (bearPow / totalPow * 100).toFixed(1);
  const bullPct  = (bullPow / totalPow * 100).toFixed(1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
        <span style={{ color: col.bear, fontFamily: col.mono, fontSize: "12px", fontWeight: "700" }}>
          BEAR {bearPct}%
        </span>
        <span style={{ color: col.bull, fontFamily: col.mono, fontSize: "12px", fontWeight: "700" }}>
          BULL {bullPct}%
        </span>
      </div>
      <div style={{
        height: "10px", background: col.border,
        borderRadius: "5px", overflow: "hidden",
        display: "flex",
      }}>
        <div style={{ width: `${bearPct}%`, background: col.bear }} />
        <div style={{ width: `${bullPct}%`, background: col.bull }} />
      </div>

      {/* Per-TF weight contribution pills */}
      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {timeframes.map(tf => {
          const tfPow = tf.weight * Math.max(tf.strength, 0.1);
          const tfPct = (tfPow / totalPow * 100).toFixed(0);
          const c = dirCol(tf.direction);
          return (
            <div key={tf.tf} style={{
              background: `${c}18`, border: `1px solid ${c}35`,
              borderRadius: "5px", padding: "4px 8px",
              display: "flex", gap: "5px", alignItems: "center",
            }}>
              <span style={{ color: c, fontFamily: col.mono, fontSize: "11px", fontWeight: "700" }}>
                {tf.tf}
              </span>
              <span style={{ color: col.dim, fontFamily: col.mono, fontSize: "10px" }}>
                {tfPct}%
              </span>
            </div>
          );
        })}
      </div>
      <div style={{
        color: col.dim, fontFamily: col.mono,
        fontSize: "9px", marginTop: "8px",
        lineHeight: "1.5",
      }}>
        משקל = weight × max(strength, 0.1) — TF גבוהים שולטים בסינק
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WAVE HIERARCHY & SURF GUIDE
// ═══════════════════════════════════════════════════════════════
function WaveHierarchy({ groups }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {groups.map((g, i) => {
        const c = dirCol(g.direction);
        return (
          <div key={i} style={{
            paddingLeft: `${i * 16}px`,
            display: "flex", alignItems: "flex-start", gap: "6px",
          }}>
            {i > 0 && (
              <span style={{
                color: col.dim, fontFamily: col.mono,
                fontSize: "13px", marginTop: "2px", flexShrink: 0,
              }}>└─</span>
            )}
            <div style={{
              background: `${c}14`,
              border: `1px solid ${c}40`,
              borderRadius: "7px",
              padding: "8px 12px",
              flex: 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  color: c, fontFamily: col.mono,
                  fontSize: "12px", fontWeight: "700",
                }}>
                  {dirLabel(g.direction)} {g.label}
                </span>
                <span style={{
                  color: col.dim, fontFamily: col.mono, fontSize: "10px",
                }}>
                  [{g.tfs.join(" · ")}]
                </span>
              </div>
              <div style={{
                color: col.muted, fontFamily: col.mono,
                fontSize: "10px", lineHeight: "1.5",
              }}>
                {g.surfDesc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MARKET STORY
// ═══════════════════════════════════════════════════════════════
function MarketStory({ story }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {story.map((line, i) => (
        <div key={i} style={{
          display: "flex", gap: "8px", alignItems: "flex-start",
          padding: "6px 0",
          borderBottom: i < story.length - 1 ? `1px solid ${col.border}50` : "none",
        }}>
          <span style={{
            color: col.dim, fontFamily: col.mono,
            fontSize: "10px", marginTop: "3px", flexShrink: 0,
          }}>▸</span>
          <span style={{
            color: col.muted, fontFamily: col.mono,
            fontSize: "11px", lineHeight: "1.6", direction: "rtl",
          }}>
            {line}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SYNC THRESHOLD SCALE
// ═══════════════════════════════════════════════════════════════
function SyncScale({ currentPct }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {SYNC_THRESHOLDS.map(tier => {
        const active = currentPct >= tier.min && currentPct < tier.max;
        return (
          <div key={tier.label} style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            borderRadius: "6px",
            background: active ? `${tier.color}18` : "transparent",
            border: active ? `1px solid ${tier.color}45` : `1px solid transparent`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: active ? tier.color : col.dim,
              }} />
              <span style={{
                color: active ? tier.color : col.dim,
                fontFamily: col.mono, fontSize: "11px",
                fontWeight: active ? "700" : "400",
              }}>
                {tier.label}
                {active && " ← now"}
              </span>
            </div>
            <span style={{ color: col.dim, fontFamily: col.mono, fontSize: "10px" }}>
              {tier.range}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TICKER INPUT SCREEN
// ═══════════════════════════════════════════════════════════════
function TickerInput({ onSubmit }) {
  const [input, setInput] = useState("");

  function handleSubmit() {
    const val = input.trim().toUpperCase();
    if (val) { onSubmit(val); setInput(""); }
  }

  function handleKey(e) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div style={{
      background: col.bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: col.mono,
      padding: "16px",
      boxSizing: "border-box",
    }}>
      <div style={{
        background: col.bg2,
        border: `1px solid ${col.border}`,
        borderRadius: "14px",
        padding: "48px 52px",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{ color: col.info, fontSize: "11px", letterSpacing: "3px", marginBottom: "12px" }}>
          🌊 FRACTAL POSITION ENGINE
        </div>
        <div style={{ color: col.text, fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>
          איזה טיקר לנתח?
        </div>
        <div style={{ color: col.muted, fontSize: "11px", marginBottom: "32px" }}>
          הקלד סימבול (לדוגמה: BTC-USD, AAPL, ETH-USD)
        </div>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="BTC-USD"
          style={{
            width: "100%",
            background: col.bg3,
            border: `1px solid ${col.border}`,
            borderRadius: "8px",
            padding: "14px 18px",
            color: col.text,
            fontFamily: col.mono,
            fontSize: "20px",
            fontWeight: "700",
            textAlign: "center",
            outline: "none",
            boxSizing: "border-box",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            width: "100%",
            background: col.info,
            border: "none",
            borderRadius: "8px",
            padding: "13px",
            color: col.bg,
            fontFamily: col.mono,
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "2px",
            cursor: "pointer",
          }}
        >
          נתח ← ENTER
        </button>
        <div style={{ color: col.dim, fontSize: "9px", marginTop: "20px" }}>
          לחץ ENTER או לחץ על הכפתור
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function FractalDashboard() {
  const [activeTicker, setActiveTicker] = useState(null);

  if (!activeTicker) {
    return <TickerInput onSubmit={setActiveTicker} />;
  }

  // Use mock DATA but override ticker name with whatever was typed
  const data = { ...DATA, ticker: activeTicker };
  const { ticker, price, marketState, sync, timeframes, groups, story } = data;
  const stateMeta = STATE_META[marketState] || { color: col.neutral, icon: "?", en: "", action: "" };

  const card = {
    background: col.bg2,
    border: `1px solid ${col.border}`,
    borderRadius: "10px",
    padding: "16px",
  };

  const sectionLabel = {
    color: col.dim,
    fontFamily: col.mono,
    fontSize: "9px",
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    marginBottom: "12px",
  };

  return (
    <div style={{
      background: col.bg,
      minHeight: "100vh",
      padding: "16px",
      boxSizing: "border-box",
      fontFamily: col.mono,
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        ...card,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 22px",
        marginBottom: "14px",
      }}>
        {/* Left: title + price */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" }}>
            <div style={{
              color: col.info, fontSize: "10px",
              letterSpacing: "3px",
            }}>
              🌊 FRACTAL POSITION ENGINE
            </div>
            <button
              onClick={() => setActiveTicker(null)}
              style={{
                background: `${col.info}18`,
                border: `1px solid ${col.info}40`,
                borderRadius: "5px",
                padding: "3px 10px",
                color: col.info,
                fontFamily: col.mono,
                fontSize: "9px",
                letterSpacing: "1.5px",
                cursor: "pointer",
              }}
            >
              ← טיקר אחר
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <span style={{
              color: col.text, fontSize: "20px", fontWeight: "700",
            }}>{ticker}</span>
            <span style={{
              color: "#ffffff", fontSize: "28px", fontWeight: "700",
            }}>
              ${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Right: state + sync */}
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          {/* Market state card */}
          <div style={{
            background: `${stateMeta.color}18`,
            border: `1px solid ${stateMeta.color}55`,
            borderRadius: "9px",
            padding: "10px 18px",
            textAlign: "center",
            minWidth: "170px",
          }}>
            <div style={{
              color: stateMeta.color,
              fontSize: "16px", fontWeight: "700",
              letterSpacing: "1px",
            }}>
              {stateMeta.icon} {marketState}
            </div>
            <div style={{
              color: col.muted, fontSize: "10px", marginTop: "3px",
            }}>{stateMeta.en}</div>
            <div style={{
              color: stateMeta.color, fontSize: "10px",
              marginTop: "4px", opacity: 0.85,
            }}>→ {stateMeta.action}</div>
          </div>

          <SyncGauge pct={sync.pct} label={sync.label} />
        </div>
      </div>

      {/* ═══ WAVE VIZ + HIERARCHY ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: "14px",
        marginBottom: "14px",
      }}>
        <div style={{ ...card, padding: "14px 16px 8px" }}>
          <div style={sectionLabel}>מבנה גל פרקטלי — זמן →</div>
          <WaveCanvas groups={groups} />
        </div>

        <div style={{ ...card }}>
          <div style={sectionLabel}>🏄 מיקום בגל — SURF GUIDE</div>
          <WaveHierarchy groups={groups} />
        </div>
      </div>

      {/* ═══ TF TABLE ═══ */}
      <div style={{
        ...card,
        padding: 0,
        overflow: "hidden",
        marginBottom: "14px",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "44px 50px 100px 90px 90px 130px 44px 54px",
          gap: "8px",
          padding: "9px 16px",
          background: col.bg3,
          borderBottom: `2px solid ${col.border}`,
        }}>
          {["TF","SIDE","STRENGTH","MOMENTUM","STRUCTURE","CONTROL","WEIGHT","PRESSURE"].map(h => (
            <span key={h} style={{
              color: col.dim, fontSize: "9px",
              letterSpacing: "1.5px", fontWeight: "600",
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {timeframes.map(tf => <TFRow key={tf.tf} tf={tf} />)}

        {/* Legend */}
        <div style={{
          display: "flex", gap: "20px", padding: "10px 16px",
          background: col.bg3,
          borderTop: `1px solid ${col.border}`,
        }}>
          {[
            { c: col.bear, label: "MACRO WAVE" },
            { c: col.bull, label: "CORRECTION" },
            { c: col.bear, label: "RESUMPTION", dashed: true },
          ].map(g => (
            <div key={g.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "14px", height: "4px",
                background: `${g.c}50`,
                borderRadius: "2px",
                ...(g.dashed && { backgroundImage: `repeating-linear-gradient(90deg,${g.c}50 0px,${g.c}50 5px,transparent 5px,transparent 8px)`, background: "none" }),
              }} />
              <span style={{ color: col.dim, fontSize: "9px" }}>{g.label}</span>
            </div>
          ))}
          <span style={{ color: col.dim, fontSize: "9px", marginLeft: "auto" }}>
            STRENGTH &gt; 1.00 ✓ = קנדל חזק מ-ATR | PRESSURE = strength × |momentum|
          </span>
        </div>
      </div>

      {/* ═══ BOTTOM PANELS ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 220px",
        gap: "14px",
      }}>
        {/* Weighted sync */}
        <div style={card}>
          <div style={sectionLabel}>📊 Weighted Sync Breakdown</div>
          <WeightedSync timeframes={timeframes} />
        </div>

        {/* Market story */}
        <div style={card}>
          <div style={sectionLabel}>📖 Market Story</div>
          <MarketStory story={story} />
        </div>

        {/* Sync levels */}
        <div style={card}>
          <div style={sectionLabel}>Sync Thresholds</div>
          <SyncScale currentPct={sync.pct} />
          <div style={{
            marginTop: "12px",
            padding: "8px",
            background: col.bg3,
            borderRadius: "6px",
            color: col.muted,
            fontSize: "9px",
            lineHeight: "1.6",
          }}>
            <div>NOISE &lt;55%: רעש, אין כיוון</div>
            <div>BUILDING 55–75%: כיוון מתגבש</div>
            <div>ALIGNED 75–92%: כיוון ברור</div>
            <div>MATURE &gt;92%: כיוון בשל, שים לב להיפוך</div>
          </div>
        </div>
      </div>
    </div>
  );
}
