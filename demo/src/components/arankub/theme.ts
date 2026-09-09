import type { CSSProperties } from "react";

/** โทเคนจากไฟล์ดีไซน์ "ARANKUB AI App.dc.html" */
export const C = {
  primary: "#6D5EF0",
  violet: "#8B5CF6",
  blue: "#4C6FFF",
  lilac: "#a78bfa",
  ink: "#17162a",
  ink2: "#241f3d",
  body: "#5c5872",
  muted: "#8b87a0",
  faint: "#a9a5bc",
  good: "#3fa876",
  warn: "#e0913a",
  bad: "#d1495b",
  track: "#f0edf9",
} as const;

export const POPPINS = "var(--font-poppins), 'Poppins', system-ui, sans-serif";

/** การ์ดกระจกของหน้ามือถือ */
export const glass: CSSProperties = {
  background: "rgba(255,255,255,.62)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  borderRadius: 24,
  boxShadow: "0 4px 16px rgba(0,0,0,.05)",
  padding: 18,
};

/** การ์ดกระจกของหน้าเว็บ — ใสกว่า เงานุ่มกว่า */
export const glassWeb: CSSProperties = {
  background: "rgba(255,255,255,.5)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,.75)",
  borderRadius: 26,
  boxShadow: "0 10px 30px rgba(84,64,160,.07)",
  padding: 18,
};

export const cardTitle: CSSProperties = { fontSize: 14.5, fontWeight: 600, color: "#1a1826" };
export const cardSub: CSSProperties = { fontSize: 11.5, color: C.muted };
export const bigNum: CSSProperties = { fontFamily: POPPINS, fontWeight: 800, letterSpacing: "-1px", color: C.ink };

export const segment = (active: boolean): CSSProperties => ({
  minHeight: 46,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 20px",
  borderRadius: 100,
  fontSize: 12.5,
  fontWeight: active ? 700 : 600,
  cursor: "pointer",
  background: active ? C.primary : "rgba(255,255,255,.6)",
  border: `1px solid ${active ? C.primary : "rgba(255,255,255,.8)"}`,
  color: active ? "#fff" : C.body,
  boxShadow: active ? "0 8px 20px rgba(109,94,240,.32)" : "none",
});

export const navPill = (active: boolean): CSSProperties => ({
  borderRadius: 100,
  padding: "10px 15px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  background: active ? C.primary : "rgba(255,255,255,.55)",
  backdropFilter: "blur(14px)",
  border: `1px solid ${active ? C.primary : "rgba(255,255,255,.7)"}`,
  color: active ? "#fff" : C.body,
  boxShadow: active ? "0 6px 16px rgba(109,94,240,.35)" : "none",
});

export const pillChip = (color: string, bg: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  color,
  background: bg,
  padding: "4px 9px",
  borderRadius: 100,
  whiteSpace: "nowrap",
});

export const barTrack: CSSProperties = {
  height: 8,
  background: "rgba(255,255,255,.85)",
  borderRadius: 100,
  overflow: "hidden",
};

export const miniTile: CSSProperties = {
  flex: 1,
  padding: "11px 12px",
  borderRadius: 16,
  background: "rgba(255,255,255,.75)",
  minWidth: 0,
};

/* ------------------------------------------------------------------ utils */

export const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");

/** ฿486,200 / ฿8.42M — ย่อหลักล้านเหมือนในดีไซน์ */
export const baht = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(n).toLocaleString("th-TH")}`;
};

export const trendColor = (up: boolean | null) => (up === null ? C.muted : up ? C.bad : C.good);

const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_DAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const thaiDate = (d: Date) => `วัน${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`;
export const thaiDateShort = (d: Date) => `${TH_DAY_SHORT[d.getDay()]} ${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`;
export const clock24 = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const greeting = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

export const initials = (name: string) =>
  name
    .replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2);
