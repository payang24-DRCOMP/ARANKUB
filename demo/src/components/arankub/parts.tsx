"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { C, POPPINS, barTrack, bigNum, fmt } from "./theme";

/* ------------------------------------------------------------------- orb */

/** ทรงกลม AI เรืองแสง — หัวใจของดีไซน์ */
export function Orb({ size, listening, onClick }: { size: number; listening?: boolean; onClick?: () => void }) {
  return (
    <div style={{ position: "relative", width: size, height: size, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      {listening && (
        <>
          <span className="ark-ripple" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(109,94,240,.55)" }} />
          <span
            className="ark-ripple"
            style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(139,92,246,.45)", animationDelay: ".55s" }}
          />
        </>
      )}
      <div
        className="ark-breathe"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: "radial-gradient(circle at 34% 28%,#ffffff 0%,#ddd3fb 20%,#8B5CF6 60%,#5b45d6 100%)",
          boxShadow: "0 20px 44px rgba(90,74,220,.4), inset 0 -12px 30px rgba(60,40,150,.42)",
        }}
      >
        <div
          className="ark-spin"
          style={{
            position: "absolute",
            inset: 5,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg,rgba(255,255,255,.5),rgba(139,92,246,0) 40%,rgba(76,111,255,.45) 65%,rgba(255,255,255,0) 95%)",
            filter: "blur(12px)",
            opacity: 0.75,
          }}
        />
        <div
          className="ark-blob"
          style={{
            position: "absolute",
            left: "24%",
            top: "52%",
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(124,178,255,.75),transparent 70%)",
            filter: "blur(10px)",
          }}
        />
        <div
          className="ark-glow"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: "50%",
            background: "radial-gradient(circle,#ffffff,rgba(214,199,255,.55) 55%,transparent 78%)",
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- kpi cards */

export function KpiCard({
  label,
  value,
  unit,
  delta,
  good,
  color,
  style,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  good: boolean;
  color: string;
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: C.body, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 22, color: C.ink, letterSpacing: "-.6px" }}>{value}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 5, color: good ? C.good : C.bad }}>{delta}</div>
    </div>
  );
}

/* ------------------------------------------------------------- bar charts */

/** กล่องตัวเลขที่ลอยขึ้นมาตอนชี้/แตะแท่ง */
function BarTooltip({ title, rows, align }: { title: string; rows: { label: string; value: string; color: string }[]; align: "left" | "center" | "right" }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: align === "left" ? 0 : align === "right" ? "auto" : "50%",
        right: align === "right" ? 0 : "auto",
        transform: align === "center" ? "translateX(-50%)" : undefined,
        zIndex: 5,
        padding: "7px 10px",
        borderRadius: 10,
        background: "rgba(26,24,38,.94)",
        color: "#fff",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 6px 18px rgba(30,20,60,.3)",
      }}
    >
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", marginBottom: 3 }}>{title}</div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: r.color, flexShrink: 0 }} />
          <span style={{ color: "rgba(255,255,255,.7)" }}>{r.label}</span>
          <span style={{ fontFamily: POPPINS, fontWeight: 700, marginLeft: "auto" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** ตำแหน่งกล่องตัวเลข — แท่งริมซ้าย/ขวาต้องชิดขอบ ไม่งั้นล้นออกนอกการ์ด */
const tipAlign = (i: number, n: number) => (i <= 1 ? "left" : i >= n - 2 ? "right" : "center") as "left" | "center" | "right";

/** แท่งซ้อน: ค่าเฉลี่ยจาง (พื้นหลัง) + ค่าวันนี้เข้ม (หน้า) */
export function OverlayBars({
  data,
  height = 110,
  labelEvery = 1,
  showValues = false,
  seriesLabels = ["วันนี้", "เฉลี่ย"],
  unit = "",
}: {
  data: { label: string; front: number; back: number }[];
  height?: number;
  labelEvery?: number;
  /** พิมพ์ตัวเลขไว้เหนือแท่งที่มีค่า (เหมาะกับกราฟที่มีค่าไม่กี่แท่ง) */
  showValues?: boolean;
  seriesLabels?: [string, string] | string[];
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.flatMap((d) => [d.front, d.back]), 1);
  const hasBack = data.some((d) => d.back > 0);
  const barH = height - 24 - (showValues ? 12 : 0);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, position: "relative" }}>
      {data.map((d, i) => (
        <div
          key={d.label}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          onClick={() => setHover((h) => (h === i ? null : i))}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            justifyContent: "flex-end",
            position: "relative",
            cursor: "default",
          }}
        >
          {hover === i && (
            <BarTooltip
              title={`${d.label}${unit ? ` ${unit}` : ""}`}
              align={tipAlign(i, data.length)}
              rows={[
                { label: seriesLabels[0], value: fmt(d.front), color: C.primary },
                ...(hasBack ? [{ label: seriesLabels[1], value: fmt(d.back), color: "rgba(167,139,250,.65)" }] : []),
              ]}
            />
          )}

          {showValues && (
            <span style={{ fontSize: 8.5, fontFamily: POPPINS, fontWeight: 700, color: d.front > 0 ? C.primary : "transparent", height: 11 }}>
              {d.front > 0 ? fmt(d.front) : "0"}
            </span>
          )}

          <div style={{ position: "relative", width: "100%", height: barH, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: "100%",
                height: `${(d.back / max) * 100}%`,
                borderRadius: "4px 4px 0 0",
                background: hover === i ? "rgba(109,94,240,.35)" : "rgba(109,94,240,.22)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: "54%",
                height: `${(d.front / max) * 100}%`,
                borderRadius: "4px 4px 0 0",
                background: "linear-gradient(180deg,#a78bfa,#6D5EF0)",
                opacity: hover === null || hover === i ? 1 : 0.55,
              }}
            />
          </div>
          <span style={{ fontSize: 8, color: hover === i ? C.primary : "#78748f", fontWeight: hover === i ? 700 : 400, height: 10 }}>
            {i % labelEvery === 0 || hover === i ? d.label : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/** แท่งคู่เคียงกัน — รับใหม่/จำหน่าย, ปีนี้/ปีก่อน */
export function PairedBars({
  data,
  height = 126,
  colors = ["linear-gradient(180deg,#a78bfa,#6D5EF0)", "linear-gradient(180deg,#93b4ff,#4C6FFF)"],
  barWidth = 10,
  showValues = false,
  seriesLabels = ["ชุดที่ 1", "ชุดที่ 2"],
}: {
  data: { label: string; a: number; b: number }[];
  height?: number;
  colors?: [string, string] | string[];
  barWidth?: number;
  /** พิมพ์ค่าที่สูงกว่าของแต่ละคู่ไว้เหนือแท่ง */
  showValues?: boolean;
  seriesLabels?: [string, string] | string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const barH = height - 24 - (showValues ? 12 : 0);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, position: "relative" }}>
      {data.map((d, i) => (
        <div
          key={d.label}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          onClick={() => setHover((h) => (h === i ? null : i))}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            justifyContent: "flex-end",
            position: "relative",
            cursor: "default",
          }}
        >
          {hover === i && (
            <BarTooltip
              title={d.label}
              align={tipAlign(i, data.length)}
              rows={[
                { label: seriesLabels[0], value: fmt(d.a), color: C.primary },
                { label: seriesLabels[1], value: fmt(d.b), color: colors[1].includes("2f9e6f") ? "#2f9e6f" : C.blue },
              ]}
            />
          )}

          {showValues && (
            <span style={{ fontSize: 8.5, fontFamily: POPPINS, fontWeight: 700, color: C.ink, height: 11 }}>
              {d.a > 0 || d.b > 0 ? fmt(Math.max(d.a, d.b)) : ""}
            </span>
          )}

          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: barH }}>
            <div
              style={{
                width: barWidth,
                height: `${(d.a / max) * 100}%`,
                borderRadius: "5px 5px 0 0",
                background: colors[0],
                opacity: hover === null || hover === i ? 1 : 0.5,
              }}
            />
            <div
              style={{
                width: barWidth,
                height: `${(d.b / max) * 100}%`,
                borderRadius: "5px 5px 0 0",
                background: colors[1],
                opacity: hover === null || hover === i ? 1 : 0.5,
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: hover === i ? C.primary : "#78748f", fontWeight: hover === i ? 700 : 400 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.body }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

const DONUT_COLORS = ["#6D5EF0", "#4C6FFF", "#a78bfa", "#cbc4f2", "#e6e1f8"];

export function Donut({
  data,
  total,
  size = 104,
  centerValue,
  centerUnit = "ราย",
}: {
  data: { label: string; pct: number }[];
  total: number;
  size?: number;
  centerValue?: string;
  centerUnit?: string;
}) {
  const stops = data
    .map((d, i) => {
      const from = data.slice(0, i).reduce((s, x) => s + x.pct, 0);
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${from}% ${from + d.pct}%`;
    })
    .join(",");
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(${stops || "#e6e1f8 0% 100%"})`,
          boxShadow: "0 8px 24px rgba(84,64,160,.16)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.18,
          borderRadius: "50%",
          background: "rgba(255,255,255,.96)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: size * 0.15, color: C.ink }}>{centerValue ?? fmt(total)}</span>
        <span style={{ fontSize: 9, color: C.muted }}>{centerUnit}</span>
      </div>
    </div>
  );
}

export const donutColor = (i: number) => DONUT_COLORS[i % DONUT_COLORS.length];

/* --------------------------------------------------------------- area line */

/** กราฟเส้น + พื้นที่ใต้เส้น (รายรับ 12 เดือน) พร้อมเส้นประของปีก่อน */
export function AreaLine({
  values,
  compare,
  height = 104,
  id,
}: {
  values: number[];
  compare?: number[];
  height?: number;
  id: string;
}) {
  const W = 300;
  const all = [...values, ...(compare ?? [])].filter((v) => v > 0);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, max);
  const pad = 12;
  const y = (v: number) => height - pad - ((v - min) / Math.max(max - min, 1)) * (height - pad * 2);
  const x = (i: number, n: number) => (i / Math.max(n - 1, 1)) * W;

  const pts = values.map((v, i) => `${x(i, values.length).toFixed(1)},${y(v).toFixed(1)}`);
  const cmpPts = compare?.map((v, i) => `${x(i, compare.length).toFixed(1)},${y(v).toFixed(1)}`);
  const lastIdx = values.length - 1;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="แนวโน้มรายรับ">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity=".38" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${pts.join(" L")} L${W},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={C.primary} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {cmpPts && <polyline points={cmpPts.join(" ")} fill="none" stroke={C.lilac} strokeWidth="1.6" strokeDasharray="4 4" />}
      {values.length > 0 && <circle cx={x(lastIdx, values.length)} cy={y(values[lastIdx])} r="4" fill={C.primary} stroke="#fff" strokeWidth="2" />}
    </svg>
  );
}

/* ------------------------------------------------------------ ranked rows */

export function RankRow({
  rank,
  code,
  name,
  count,
  pct,
  trend,
}: {
  rank: number;
  code: string;
  name: string;
  count: number;
  pct: number;
  trend: number | null;
}) {
  const top = rank <= 3;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 7,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: POPPINS,
            fontSize: 10,
            fontWeight: 700,
            color: top ? "#fff" : C.primary,
            background: top ? "linear-gradient(135deg,#8B5CF6,#6D5EF0)" : "rgba(255,255,255,.9)",
          }}
        >
          {rank}
        </span>
        <span style={{ fontFamily: POPPINS, fontSize: 10.5, fontWeight: 700, color: C.primary, flexShrink: 0 }}>{code}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
        <span style={{ fontFamily: POPPINS, fontSize: 11, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{fmt(count)}</span>
        <span style={{ width: 44, textAlign: "right", flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: trend === null ? C.muted : trend >= 0 ? C.bad : C.good }}>
          {trend === null ? "ใหม่" : `${trend >= 0 ? "↑" : "↓"} ${Math.abs(trend).toFixed(0)}%`}
        </span>
      </div>
      <div style={{ height: 7, background: C.track, borderRadius: 100, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 100,
            background: top ? "linear-gradient(90deg,#8B5CF6,#6D5EF0)" : "linear-gradient(90deg,#c4b5fd,#a78bfa)",
          }}
        />
      </div>
    </div>
  );
}

export function Podium({ rank, code, name, count, pct, trend }: { rank: number; code: string; name: string; count: number; pct: number; trend: number | null }) {
  const first = rank === 1;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: 14,
        borderRadius: 20,
        background: first ? "linear-gradient(160deg,rgba(255,255,255,.95),rgba(238,233,253,.9))" : "rgba(255,255,255,.68)",
        border: first ? `1.5px solid ${C.primary}` : "1px solid rgba(255,255,255,.85)",
        boxShadow: first ? "0 10px 26px rgba(109,94,240,.2)" : "0 4px 14px rgba(84,64,160,.07)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: POPPINS,
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            background:
              rank === 1
                ? "linear-gradient(135deg,#8B5CF6,#6D5EF0)"
                : rank === 2
                  ? "linear-gradient(135deg,#a5b4fc,#4C6FFF)"
                  : "linear-gradient(135deg,#c4b5fd,#a78bfa)",
          }}
        >
          {rank}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: trend === null ? C.muted : trend >= 0 ? C.bad : C.good }}>
          {trend === null ? "ใหม่" : `${trend >= 0 ? "↑" : "↓"} ${Math.abs(trend).toFixed(0)}%`}
        </span>
      </div>
      <div style={{ fontFamily: POPPINS, fontSize: 10.5, fontWeight: 700, color: C.primary, marginBottom: 3 }}>{code}</div>
      <div style={{ fontSize: 10.5, color: C.ink2, fontWeight: 500, lineHeight: 1.35, marginBottom: 8, minHeight: 28, overflow: "hidden" }}>{name}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ ...bigNum, fontWeight: 700, fontSize: 18, letterSpacing: "-.5px" }}>{fmt(count)}</span>
        <span style={{ fontSize: 9.5, color: C.muted }}>ครั้ง</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,.9)", borderRadius: 100, marginTop: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#8B5CF6,#6D5EF0)" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function BarRow({
  name,
  right,
  pct,
  gradient = "linear-gradient(90deg,#8B5CF6,#4C6FFF)",
  dot,
}: {
  name: string;
  right: ReactNode;
  pct: number;
  gradient?: string;
  dot?: string;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 12.5, color: C.ink2, fontWeight: 500, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: `0 0 8px ${dot}66` }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </span>
        <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>{right}</span>
      </div>
      <div style={barTrack}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 100, background: gradient }} />
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
      <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1826" }}>{children}</span>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: 22, textAlign: "center", fontSize: 12.5, color: C.muted }}>{children}</div>;
}
