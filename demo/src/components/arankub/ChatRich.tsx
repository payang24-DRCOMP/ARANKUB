"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, POPPINS } from "./theme";

/**
 * เนื้อหาคำตอบของผู้ช่วย — markdown (ตาราง/หัวข้อ/ลิสต์) + โค้ดบล็อก ```chart
 * ใช้ spec เดียวกับหน้า /chat เดิม เพื่อให้ prompt/โมเดลชุดเดิมใช้ได้ทันที
 */

interface ChartSpec {
  type: "bar" | "line" | "pie";
  title?: string;
  xKey?: string;
  series?: { key: string; label?: string }[];
  data: Record<string, unknown>[];
}

// พาเลตต์ม่วง-น้ำเงินของ ARANKUB (ไล่เฉดให้แยกกันได้แม้พิมพ์ขาวดำ)
const PALETTE = ["#6D5EF0", "#4C6FFF", "#a78bfa", "#2bb3a3", "#e0913a", "#d1495b", "#7c8aff", "#c4b5fd"];

function parseSpec(raw: string): ChartSpec | null {
  try {
    const spec = JSON.parse(raw) as ChartSpec;
    if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) return null;
    if (!["bar", "line", "pie"].includes(spec.type)) return null;
    return spec;
  } catch {
    return null;
  }
}

function ArkChart({ raw }: { raw: string }) {
  const spec = parseSpec(raw);
  // ยังสตรีมไม่จบ JSON จะยังไม่สมบูรณ์ — แสดงเป็นข้อความไปพลางก่อน
  if (!spec) {
    return (
      <pre style={{ margin: "8px 0", overflowX: "auto", borderRadius: 12, background: "rgba(109,94,240,.08)", padding: 10, fontSize: 11 }}>
        <code>{raw}</code>
      </pre>
    );
  }

  const xKey = spec.xKey ?? "name";
  const declared = (spec.series ?? []).filter((s) => s.key in spec.data[0]);
  const series =
    declared.length > 0
      ? declared
      : Object.keys(spec.data[0])
          .filter((k) => k !== xKey && typeof spec.data[0][k] === "number")
          .map((k) => ({ key: k, label: k }));

  const axis = { fontSize: 10, fill: "#78748f" };

  return (
    <div style={{ margin: "10px 0", padding: 12, borderRadius: 18, background: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.9)" }}>
      {spec.title && <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2, marginBottom: 8 }}>{spec.title}</div>}
      <ResponsiveContainer width="100%" height={220}>
        {spec.type === "pie" ? (
          <PieChart>
            <Pie data={spec.data} dataKey={series[0]?.key ?? "value"} nameKey={xKey} outerRadius={78} label>
              {spec.data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        ) : spec.type === "line" ? (
          <LineChart data={spec.data}>
            <CartesianGrid stroke="rgba(109,94,240,.12)" vertical={false} />
            <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
            <Tooltip />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.2} dot={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={spec.data}>
            <CartesianGrid stroke="rgba(109,94,240,.12)" vertical={false} />
            <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
            <Tooltip />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={PALETTE[i % PALETTE.length]} radius={[5, 5, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const components: Components = {
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className || "")?.[1] ?? "";
    const code = String(children).replace(/\n$/, "");

    if (lang === "chart") return <ArkChart raw={code} />;

    if (!className && !code.includes("\n")) {
      return (
        <code style={{ padding: "1px 5px", borderRadius: 5, background: "rgba(109,94,240,.12)", color: "#5539d6", fontSize: "0.88em" }} {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre style={{ margin: "8px 0", overflowX: "auto", borderRadius: 12, background: "#1e1b32", color: "#e6e1f8", padding: 12, fontSize: 11.5, lineHeight: 1.6 }}>
        <code>{code}</code>
      </pre>
    );
  },

  table({ children }) {
    return (
      <div style={{ margin: "10px 0", overflowX: "auto", borderRadius: 14, border: "1px solid rgba(109,94,240,.18)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead style={{ background: "rgba(109,94,240,.09)" }}>{children}</thead>;
  },
  th({ children }) {
    return <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.ink2, borderBottom: "1px solid rgba(109,94,240,.18)", whiteSpace: "nowrap" }}>{children}</th>;
  },
  td({ children }) {
    return <td style={{ padding: "7px 10px", borderBottom: "1px solid rgba(109,94,240,.09)", color: "#2a2738" }}>{children}</td>;
  },

  h1: ({ children }) => <div style={{ fontFamily: POPPINS, fontSize: 15, fontWeight: 700, color: C.ink, margin: "10px 0 6px" }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontFamily: POPPINS, fontSize: 14, fontWeight: 700, color: C.ink, margin: "10px 0 5px" }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, margin: "8px 0 4px" }}>{children}</div>,
  p: ({ children }) => <p style={{ margin: "5px 0", lineHeight: 1.6 }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: "5px 0", paddingLeft: 20, lineHeight: 1.6 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "5px 0", paddingLeft: 20, lineHeight: 1.6 }}>{children}</ol>,
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: C.ink }}>{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote style={{ margin: "8px 0", paddingLeft: 12, borderLeft: `3px solid ${C.primary}66`, color: C.body }}>{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} style={{ color: C.primary, textDecoration: "underline" }} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function ChatRich({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13.5 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
