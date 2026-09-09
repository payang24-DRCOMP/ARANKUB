"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, miniTile } from "./theme";
import { Empty, OverlayBars, SectionTitle } from "./parts";

/**
 * ยอดวันนี้แบบเรียลไทม์ — อ่าน opitemrece สดจาก HosXP ทุก 60 วินาที
 * เห็นทันทีที่ห้องบัตรคีย์บิล ต่างจากกราฟรายเดือนที่อิง REP ซึ่งตามหลัง 1-2 เดือน
 */

interface LiveItem {
  code: string;
  label: string;
  count: number;
  patients: number;
  amount: number;
}

interface LiveService {
  key: string;
  label: string;
  total: number;
  patients: number;
  amount: number;
  baseline: { avgOnActiveDays: number; activeDays: number; totalDays: number; bursty: boolean };
  items: LiveItem[];
  hours: { hour: string; count: number }[];
  recent: { date: string; count: number }[];
  lastServiceDate: string | null;
}

interface LiveRes {
  date: string;
  updatedAt: string;
  services: LiveService[];
  feed: { code: string; label: string; service: string; hn: string; time: string; amount: number; clinic: string }[];
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const dayLabel = (d: string) => {
  const [, m, dd] = d.split("-").map(Number);
  return `${dd} ${TH_MONTH[m - 1]}`;
};

export function ServicesLive({ cardStyle, fund }: { cardStyle: CSSProperties; fund: string }) {
  const [data, setData] = useState<LiveRes | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/arankub/services-live");
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000); // เรียลไทม์ทุก 1 นาที
    return () => clearInterval(t);
  }, [load]);

  if (error && !data) return <Empty>เชื่อมต่อ HosXP ไม่ได้ จึงยังไม่ทราบยอดวันนี้</Empty>;
  if (!data) return <Empty>กำลังอ่านยอดวันนี้จาก HosXP…</Empty>;

  const svc = data.services.find((s) => s.key === fund);
  if (!svc) return null;

  const feed = data.feed.filter((f) => f.service === fund);
  const base = svc.baseline;
  // เทียบได้เฉพาะเมื่อบริการคีย์ทุกวันจริง ๆ — ถ้าคีย์เป็นรอบ การบอก "ต่ำกว่าเฉลี่ย" จะทำให้เข้าใจผิด
  const comparable = base.avgOnActiveDays > 0 && !base.bursty;
  const vsExpected = comparable ? Math.round(((svc.total - base.avgOnActiveDays) / base.avgOnActiveDays) * 100) : null;
  const peak = svc.hours.reduce((a, b) => (b.count > a.count ? b : a), svc.hours[0]);
  const recentMax = Math.max(...svc.recent.map((r) => r.count), 1);

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <SectionTitle
        right={
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: C.muted, whiteSpace: "nowrap" }}>
            <span className="ark-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: C.good }} />
            สด · {data.updatedAt} น.
          </span>
        }
      >
        ยอดวันนี้ {svc.label}
      </SectionTitle>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ ...bigNum, fontSize: 32 }}>{fmt(svc.total)}</span>
        <span style={{ fontSize: 12.5, color: C.muted }}>ครั้ง</span>
        {vsExpected !== null && svc.total > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: vsExpected >= 0 ? C.good : C.warn,
              background: vsExpected >= 0 ? "#e7f6ee" : "#fdf3e7",
              padding: "4px 9px",
              borderRadius: 100,
            }}
          >
            {vsExpected >= 0 ? "↑" : "↓"} {Math.abs(vsExpected)}% เทียบวันเดียวกันเฉลี่ย
          </span>
        )}
      </div>

      {svc.total === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(255,255,255,.72)",
            fontSize: 12.5,
            color: C.body,
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          ยังไม่มีการคีย์บิลบริการนี้วันนี้
          {base.bursty ? (
            <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
              บริการนี้คีย์เป็นรอบ ไม่ได้คีย์ทุกวัน — 8 สัปดาห์ล่าสุดมีคีย์ {base.activeDays} จาก {base.totalDays} วันเดียวกันของสัปดาห์
              (เฉลี่ยวันที่คีย์ {base.avgOnActiveDays} ครั้ง)
            </div>
          ) : (
            base.avgOnActiveDays > 0 && (
              <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                วันเดียวกันของสัปดาห์ก่อน ๆ เฉลี่ย {base.avgOnActiveDays} ครั้ง
              </div>
            )
          )}
          {svc.lastServiceDate && (
            <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>คีย์ล่าสุด {dayLabel(svc.lastServiceDate)}</div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={miniTile}>
              <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ผู้ป่วย</div>
              <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{fmt(svc.patients)}</div>
            </div>
            <div style={miniTile}>
              <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>มูลค่าบริการ</div>
              <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{baht(svc.amount)}</div>
            </div>
            <div style={miniTile}>
              <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ชั่วโมงหนาแน่นสุด</div>
              <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{peak?.count ? `${peak.hour}:00` : "-"}</div>
            </div>
          </div>

          {svc.items.filter((i) => i.count > 0).length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {svc.items.map((i) => (
                <div key={i.code} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {i.label}
                  </span>
                  <div style={{ width: 90, height: 7, background: C.track, borderRadius: 100, overflow: "hidden", flexShrink: 0 }}>
                    <div
                      style={{
                        width: `${svc.total > 0 ? (i.count / svc.total) * 100 : 0}%`,
                        height: "100%",
                        borderRadius: 100,
                        background: "linear-gradient(90deg,#8B5CF6,#4C6FFF)",
                      }}
                    />
                  </div>
                  <span style={{ width: 34, textAlign: "right", fontFamily: POPPINS, fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>
                    {fmt(i.count)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>กระจายตามชั่วโมง</div>
          <OverlayBars
            data={svc.hours.map((h) => ({ label: `${h.hour}:00`, front: h.count, back: 0 }))}
            height={104}
            labelEvery={3}
            showValues
            seriesLabels={["จำนวน", ""]}
          />
        </>
      )}

      {/* 14 วันล่าสุด — เห็นบริบทเสมอแม้วันนี้ยังไม่มีเคส */}
      <div style={{ fontSize: 11.5, color: C.muted, margin: "14px 0 6px" }}>14 วันล่าสุด</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 62 }}>
        {svc.recent.map((r, i) => {
          const isToday = i === svc.recent.length - 1;
          return (
            <div key={r.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <div
                title={`${dayLabel(r.date)} — ${r.count} ครั้ง`}
                style={{
                  width: "100%",
                  height: `${Math.max((r.count / recentMax) * 44, r.count > 0 ? 3 : 1)}px`,
                  borderRadius: "4px 4px 0 0",
                  background: isToday ? "linear-gradient(180deg,#8B5CF6,#6D5EF0)" : "rgba(109,94,240,.3)",
                }}
              />
              <span style={{ fontSize: 7.5, color: isToday ? C.primary : C.faint, fontWeight: isToday ? 700 : 400 }}>{r.date.slice(8)}</span>
            </div>
          );
        })}
      </div>

      {/* รายการล่าสุดวันนี้ */}
      {feed.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "16px 0 8px" }}>รายการล่าสุดวันนี้</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {feed.map((f, i) => (
              <div
                key={`${f.hn}-${f.time}-${i}`}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.7)", marginBottom: 5 }}
              >
                <span style={{ fontFamily: POPPINS, fontSize: 11, fontWeight: 700, color: C.primary, flexShrink: 0, width: 38 }}>{f.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: C.ink2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    HN {f.hn} · {f.clinic}
                  </div>
                  <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>{f.label}</div>
                </div>
                <span style={{ fontSize: 11, color: C.body, flexShrink: 0 }}>{f.amount > 0 ? baht(f.amount) : "-"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
