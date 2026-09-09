"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { C, POPPINS, baht, bigNum, fmt, initials } from "./theme";
import { AreaLine, Donut, Empty, Legend, Orb, PairedBars, Podium, RankRow, SectionTitle, donutColor } from "./parts";
import { ChatRich } from "./ChatRich";
import type { PatientDetail, PatientSummary, ReportsData } from "./types";

/* ================================================================= REPORTS */

export function ReportsScreen({
  data,
  cardStyle,
  onAsk,
}: {
  data: ReportsData | null;
  cardStyle: CSSProperties;
  onAsk: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");

  if (!data) return <Empty>กำลังโหลดรายงาน…</Empty>;

  const templates = [
    { label: "สรุปผู้ป่วยนอกรายวัน", desc: "ยอดบริการ · แผนก · สิทธิการรักษา", badge: "OPD", color: C.violet },
    { label: "อัตราครองเตียงรายวอร์ด", desc: "ครองเตียง · LOS · การหมุนเวียน", badge: "IPD", color: C.blue },
    { label: "รายรับค่ารักษาตามสิทธิ", desc: "UC · ประกันสังคม · จ่ายตรง", badge: "การเงิน", color: C.primary },
    { label: "เวชระเบียนที่ติดธงการลงรหัส", desc: "ความครบถ้วน · ข้อผิดพลาด", badge: "คุณภาพ", color: C.lilac },
    { label: "เปรียบเทียบรายเดือน YoY", desc: "ปีนี้เทียบปีก่อนทุกตัวชี้วัด", badge: "เทียบ", color: C.violet },
  ];

  const diseaseMax = Math.max(...data.diseases.map((d) => d.count), 1);
  const top3 = data.diseases.slice(0, 3);
  const rest = data.diseases.slice(3);
  const deptOpdMax = Math.max(...data.deptCompare.opd.map((d) => d.count), 1);
  const deptIpdMax = Math.max(...data.deptCompare.ipd.map((d) => d.count), 1);

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Orb size={30} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1826" }}>AI สร้างรายงาน</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>แตะหัวข้อเพื่อให้ AI สรุปจากข้อมูลจริงทันที</div>
        {templates.map((t) => (
          <div
            key={t.label}
            onClick={() => onAsk(`ช่วยสรุปรายงาน "${t.label}" จากข้อมูลโรงพยาบาลให้หน่อย`)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 16, background: "rgba(255,255,255,.72)", marginBottom: 8, cursor: "pointer" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0, boxShadow: `0 0 8px ${t.color}66` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2 }}>{t.label}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{t.desc}</div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: t.color, background: "rgba(255,255,255,.9)", padding: "4px 8px", borderRadius: 7, flexShrink: 0 }}>
              {t.badge}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 100, padding: "8px 8px 8px 14px", marginTop: 12, boxShadow: "0 6px 18px rgba(84,64,160,.1)" }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prompt.trim()) {
                onAsk(prompt.trim());
                setPrompt("");
              }
            }}
            placeholder="ระบุรายงานที่ต้องการ..."
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 12.5, color: "#1a1826", background: "transparent" }}
          />
          <button
            onClick={() => {
              if (prompt.trim()) {
                onAsk(prompt.trim());
                setPrompt("");
              }
            }}
            style={{ width: 34, height: 34, borderRadius: "50%", background: C.primary, border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}
            aria-label="ส่งคำขอรายงาน"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
              <path d="M2 8l12-6-4 6 4 6-12-6z" fill="#fff" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle
          right={
            data.compareDeltaPct === null ? null : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: data.compareDeltaPct >= 0 ? C.good : C.bad,
                  background: data.compareDeltaPct >= 0 ? "#e7f6ee" : "#fdecee",
                  padding: "4px 8px",
                  borderRadius: 100,
                }}
              >
                {data.compareDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(data.compareDeltaPct)}%
              </span>
            )
          }
        >
          เปรียบเทียบผู้ป่วยรายเดือน
        </SectionTitle>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>ปีนี้เทียบปีก่อน · หน่วย: ครั้ง</div>
        <PairedBars
          data={data.compare.map((c) => ({ label: c.label.split(" ")[0], a: c.now, b: c.prev }))}
          height={150}
          barWidth={9}
          colors={["linear-gradient(180deg,#a78bfa,#6D5EF0)", "rgba(109,94,240,.25)"]}
          seriesLabels={["ปีนี้", "ปีก่อน"]}
        />
        <Legend items={[{ label: "ปีนี้", color: C.primary }, { label: "ปีก่อน", color: "rgba(109,94,240,.25)" }]} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1826", marginBottom: 3 }}>รายรับค่ารักษา 12 เดือน</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ ...bigNum, fontSize: 26, letterSpacing: "-.8px" }}>{baht(data.revenueTotal)}</span>
          {data.revenueDeltaPct !== null && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: data.revenueDeltaPct >= 0 ? C.good : C.bad }}>
              {data.revenueDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(data.revenueDeltaPct)}% จากปีก่อน
            </span>
          )}
        </div>
        <AreaLine id="ark-rev" values={data.revenue.map((r) => r.amount)} height={110} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 10, color: C.faint }}>{data.revenue[0]?.label}</span>
          <span style={{ fontSize: 10, color: C.faint }}>{data.revenue[Math.floor(data.revenue.length / 2)]?.label}</span>
          <span style={{ fontSize: 10, color: C.faint }}>{data.revenue.at(-1)?.label}</span>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>เดือนนี้</span>}>สัดส่วนสิทธิการรักษา</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Donut data={data.rights} total={data.rightsTotal} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
            {data.rights.map((r, i) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: donutColor(i), flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "#4a4658", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                <span style={{ fontFamily: POPPINS, fontSize: 11, fontWeight: 700, color: C.ink }}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ICD-10</span>}>อันดับโรคที่พบมากที่สุด</SectionTitle>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>เดือนนี้ · รวม {fmt(data.diseaseTotal)} ครั้ง · เทียบเดือนก่อน</div>
        {data.diseases.length === 0 ? (
          <Empty>ยังไม่มีข้อมูลการวินิจฉัยในเดือนนี้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
              {top3.map((d) => (
                <Podium key={d.code} rank={d.rank} code={d.code} name={d.name} count={d.count} pct={(d.count / diseaseMax) * 100} trend={d.trendPct} />
              ))}
            </div>
            {rest.map((d) => (
              <RankRow key={d.code} rank={d.rank} code={d.code} name={d.name} count={d.count} pct={(d.count / diseaseMax) * 100} trend={d.trendPct} />
            ))}
          </>
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>เดือนนี้</span>}>ปริมาณงานรายแผนก / รายวอร์ด</SectionTitle>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>OPD นับตามคลินิก · IPD นับตามวอร์ดที่จำหน่าย</div>
        {data.deptCompare.opd.map((d) => (
          <div key={`opd-${d.label}`} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
              <span style={{ fontSize: 12, color: C.ink2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.count)} ครั้ง</span>
            </div>
            <div style={{ width: `${(d.count / deptOpdMax) * 100}%`, height: 9, borderRadius: 100, background: "linear-gradient(90deg,#a78bfa,#6D5EF0)" }} />
          </div>
        ))}
        <div style={{ height: 1, background: "rgba(255,255,255,.8)", margin: "14px 0" }} />
        {data.deptCompare.ipd.map((d) => (
          <div key={`ipd-${d.label}`} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
              <span style={{ fontSize: 12, color: C.ink2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.count)} ราย</span>
            </div>
            <div style={{ width: `${(d.count / deptIpdMax) * 100}%`, height: 9, borderRadius: 100, background: "linear-gradient(90deg,#93b4ff,#4C6FFF)" }} />
          </div>
        ))}
        <Legend items={[{ label: "OPD (ครั้ง)", color: C.primary }, { label: "IPD (ราย)", color: C.blue }]} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>{data.recent.length} ฉบับ</span>}>รายงานที่บันทึกไว้</SectionTitle>
        {data.recent.length === 0 ? (
          <Empty>ยังไม่มีรายงานที่บันทึกไว้ในระบบ</Empty>
        ) : (
          data.recent.map((r) => (
            <div key={r.title + r.time} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 16, background: "rgba(255,255,255,.75)", marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.violet, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{r.time}</div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "4px 8px", borderRadius: 7, flexShrink: 0, color: C.good, background: "rgba(231,246,238,.95)" }}>
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================ PATIENTS */

export function PatientsScreen({
  cardStyle,
  onAsk,
  wide,
}: {
  cardStyle: CSSProperties;
  onAsk: (prompt: string) => void;
  wide?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<PatientSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/arankub/patients?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        const patients: PatientSummary[] = json.patients ?? [];
        setList(patients);
        setSelected((cur) => (cur && patients.some((p) => p.hn === cur) ? cur : (patients[0]?.hn ?? null)));
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/arankub/patients/${selected}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const searchBox = (
    <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", borderRadius: 100, padding: "12px 16px", marginBottom: 14, boxShadow: "0 6px 18px rgba(84,64,160,.1)" }}>
      <svg width="15" height="15" viewBox="0 0 16 16" style={{ flexShrink: 0 }} aria-hidden>
        <circle cx="6.8" cy="6.8" r="5" fill="none" stroke="#8b87a0" strokeWidth="1.5" />
        <path d="M10.6 10.6L14.5 14.5" stroke="#8b87a0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อ / HN"
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 13.5, color: "#1a1826", background: "transparent" }}
      />
      <span style={{ fontSize: 10.5, color: C.muted, flexShrink: 0 }}>{loading ? "…" : `${list?.length ?? 0} ราย`}</span>
    </div>
  );

  const detailCard = detail && (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: `linear-gradient(135deg,${C.violet},${C.blue})`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 6px 16px rgba(109,94,240,.28)",
          }}
        >
          {initials(detail.name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail.name}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>
            HN {detail.hn} · {detail.age ?? "-"} ปี · {detail.right}
          </div>
        </div>
      </div>

      {detail.vitals.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
          {detail.vitals.map((v) => (
            <div key={v.label} style={{ padding: "11px 12px", borderRadius: 16, background: "rgba(255,255,255,.78)" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{v.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: v.bad ? C.bad : C.ink }}>{v.value}</span>
                <span style={{ fontSize: 9.5, color: C.muted }}>{v.unit}</span>
              </div>
              <div style={{ fontSize: 9.5, marginTop: 4, fontWeight: 600, color: v.bad ? C.bad : C.good }}>{v.status}</div>
            </div>
          ))}
        </div>
      )}

      {detail.diagnoses.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>โรคประจำตัว / การวินิจฉัย</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {detail.diagnoses.map((d) => (
              <span key={d} style={{ fontSize: 11, fontWeight: 600, color: C.body, background: "rgba(255,255,255,.85)", padding: "6px 11px", borderRadius: 100 }}>
                {d}
              </span>
            ))}
          </div>
        </>
      )}

      {detail.labAbnormal.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>ผลแล็บผิดปกติล่าสุด</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {detail.labAbnormal.map((l) => (
              <span key={l} style={{ fontSize: 10.5, fontWeight: 600, color: C.bad, background: "rgba(255,255,255,.9)", padding: "6px 10px", borderRadius: 100 }}>
                {l}
              </span>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>ประวัติการมารับบริการ</div>
      {detail.visits.map((v, i) => (
        <div key={`${v.detail}-${i}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: i === 0 ? C.primary : "rgba(109,94,240,.35)" }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.detail}</span>
          <span style={{ fontSize: 10.5, color: C.muted, flexShrink: 0 }}>{v.date}</span>
        </div>
      ))}
    </div>
  );

  const aiCard = detail && (
    <div style={{ padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#2c2650,#1a1730)", borderRadius: 24, boxShadow: "0 8px 20px rgba(30,20,60,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Orb size={30} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI สรุปเวชระเบียน</span>
      </div>
      {detail.aiSummary ? (
        <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,.78)", whiteSpace: "pre-wrap" }}>{detail.aiSummary}</div>
      ) : (
        <>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,.6)", marginBottom: 12 }}>
            เวชระเบียนรายนี้ยังไม่ผ่านการวิเคราะห์ด้วย AI — กดปุ่มด้านล่างเพื่อให้ผู้ช่วยสรุปจากข้อมูลที่มี
          </div>
          <button
            onClick={() =>
              onAsk(
                `ช่วยสรุปเวชระเบียนผู้ป่วย HN ${detail.hn} (${detail.age ?? "-"} ปี ${detail.sex}) ` +
                  `การวินิจฉัย: ${detail.diagnoses.join(", ") || "-"} ` +
                  `สัญญาณชีพ: ${detail.vitals.map((v) => `${v.label} ${v.value}${v.unit}`).join(", ") || "-"} ` +
                  `ผลแล็บผิดปกติ: ${detail.labAbnormal.join(", ") || "-"}`
              )
            }
            style={{ background: "rgba(255,255,255,.14)", border: "none", color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 100, cursor: "pointer" }}
          >
            ให้ AI สรุปให้
          </button>
        </>
      )}
    </div>
  );

  const resultsCard = (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>แตะเพื่อดูรายงานสุขภาพ</span>}>ผลการค้นหา</SectionTitle>
      {list === null ? (
        <Empty>กำลังค้นหา…</Empty>
      ) : list.length === 0 ? (
        <Empty>ไม่พบผู้ป่วยที่ตรงกับคำค้น</Empty>
      ) : (
        list.map((p) => {
          const active = p.hn === selected;
          return (
            <div
              key={p.hn}
              onClick={() => setSelected(p.hn)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "11px 12px",
                marginBottom: 8,
                borderRadius: 16,
                cursor: "pointer",
                background: active ? "#fff" : "rgba(255,255,255,.75)",
                border: `1.5px solid ${active ? C.primary : "transparent"}`,
                boxShadow: active ? "0 8px 20px rgba(109,94,240,.16)" : "none",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg,${C.violet},${C.blue})`,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(p.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  HN {p.hn} · {p.age ?? "-"} ปี · {p.chronic}
                </div>
              </div>
              <span
                style={{
                  width: 84,
                  textAlign: "center",
                  flexShrink: 0,
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,.9)",
                  color: p.lastVisitLabel === "วันนี้" ? C.good : C.muted,
                }}
              >
                {p.lastVisitLabel}
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  if (wide) {
    return (
      <div className="ark-two">
        <div style={{ minWidth: 0 }}>
          {searchBox}
          {resultsCard}
        </div>
        <div style={{ minWidth: 0 }}>
          {detailCard}
          {aiCard}
        </div>
      </div>
    );
  }

  return (
    <>
      {searchBox}
      {detailCard}
      {aiCard}
      {resultsCard}
    </>
  );
}

/* ==================================================================== CHAT */

export type ChatMsg = { role: "user" | "assistant"; content: string };

export interface VoiceControls {
  state: "idle" | "listening" | "thinking" | "speaking";
  transcript: string;
  error: string | null;
  voiceReply: boolean;
  setVoiceReply: (v: boolean) => void;
  handsFree: boolean;
  setHandsFree: (v: boolean) => void;
  toggleListening: () => void;
}

/** สวิตช์กลม ๆ สำหรับเปิด/ปิดโหมดเสียง */
function VoiceToggle({ on, label, title, onClick, icon }: { on: boolean; label: string; title: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: on ? C.primary : "rgba(255,255,255,.75)",
        border: `1px solid ${on ? C.primary : "rgba(109,94,240,.2)"}`,
        color: on ? "#fff" : C.body,
        boxShadow: on ? "0 4px 12px rgba(109,94,240,.28)" : "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function ChatScreen({
  messages,
  isTyping,
  onSend,
  suggestions,
  voice,
}: {
  messages: ChatMsg[];
  isTyping: boolean;
  onSend: (text: string) => void;
  suggestions: string[];
  voice?: VoiceControls;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const listening = voice?.state === "listening";
  const speaking = voice?.state === "speaking";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Orb size={44} listening={listening || speaking} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: "#1a1826" }}>ARANKUB Assistant</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: listening ? C.primary : speaking ? C.violet : C.good }}>
            <span className={listening || speaking ? "ark-pulse" : undefined} style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {listening ? "กำลังฟัง… พูดได้เลยค่ะ" : speaking ? "กำลังพูดตอบ" : "ออนไลน์ · พร้อมช่วยงาน"}
          </div>
        </div>
      </div>

      {voice && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            <VoiceToggle
              on={listening || speaking}
              label={listening ? "หยุดฟัง" : speaking ? "หยุดพูด" : "พูดคำถาม"}
              title="สั่งงานด้วยเสียง"
              onClick={voice.toggleListening}
              icon={
                <svg width="11" height="13" viewBox="0 0 12 14" aria-hidden>
                  <rect x="4" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 7a4 4 0 008 0M6 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              }
            />
            <VoiceToggle
              on={voice.voiceReply}
              label="ตอบด้วยเสียง"
              title="อ่านคำตอบออกเสียงทุกครั้ง แม้พิมพ์ถาม"
              onClick={() => voice.setVoiceReply(!voice.voiceReply)}
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <path d="M2 5.2h2.2L7 2.6v8.8L4.2 8.8H2z" fill="currentColor" />
                  <path d="M9.4 5a3 3 0 010 4M11.2 3.2a5.6 5.6 0 010 7.6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                </svg>
              }
            />
            <VoiceToggle
              on={voice.handsFree}
              label="สนทนาต่อเนื่อง"
              title="พูดตอบจบแล้วกลับไปฟังต่อเองอัตโนมัติ ไม่ต้องกดซ้ำ"
              onClick={() => {
                const next = !voice.handsFree;
                voice.setHandsFree(next);
                if (next) voice.setVoiceReply(true);
              }}
              icon={
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <path d="M2.4 7a4.6 4.6 0 017.9-3.2M11.6 7a4.6 4.6 0 01-7.9 3.2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M10.4 1.6v2.4H8M3.6 12.4V10H6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
          </div>

          {(listening || voice.error) && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                background: voice.error ? "rgba(209,73,91,.08)" : "rgba(109,94,240,.08)",
                color: voice.error ? C.bad : C.body,
                border: `1px solid ${voice.error ? "rgba(209,73,91,.2)" : "rgba(109,94,240,.18)"}`,
              }}
            >
              {voice.error ?? (voice.transcript || "กำลังฟัง… พูดได้เลยค่ะ")}
            </div>
          )}
        </>
      )}

      {messages.length <= 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              style={{ background: "#fff", border: "1px solid #ece8f7", color: "#4a4658", fontSize: 12.5, padding: "9px 13px", borderRadius: 100, boxShadow: "0 2px 6px rgba(0,0,0,.04)", cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  // คำตอบมีตาราง/กราฟได้ จึงกว้างกว่าฝั่งผู้ใช้
                  maxWidth: isUser ? "78%" : "94%",
                  minWidth: 0,
                  padding: "12px 16px",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: isUser ? "pre-wrap" : undefined,
                  background: isUser ? "linear-gradient(135deg,#8B5CF6,#6D5EF0)" : "#fff",
                  color: isUser ? "#fff" : "#2a2738",
                  borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,.05)",
                }}
              >
                {isUser ? m.content : m.content ? <ChatRich text={m.content} /> : "…"}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: "4px 18px 18px 18px", padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,.05)", display: "flex", gap: 4 }}>
            {[0, 0.2, 0.4].map((d) => (
              <span key={d} className="ark-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#c4bfe0", animationDelay: `${d}s` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export function ChatComposer({ onSend, disabled, voice }: { onSend: (t: string) => void; disabled?: boolean; voice?: VoiceControls }) {
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };
  const listening = voice?.state === "listening";
  const speaking = voice?.state === "speaking";

  return (
    <div style={{ flexShrink: 0, padding: "10px 16px", background: "rgba(233,230,246,.9)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: 8 }}>
      {voice && (
        <button
          onClick={voice.toggleListening}
          title={listening ? "หยุดฟัง" : speaking ? "หยุดพูด" : "พูดคำถาม"}
          aria-label={listening ? "หยุดฟัง" : "พูดคำถาม"}
          className={listening ? "ark-pulse" : undefined}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            flexShrink: 0,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: listening || speaking ? C.primary : "#fff",
            color: listening || speaking ? "#fff" : C.body,
            boxShadow: listening || speaking ? "0 4px 14px rgba(109,94,240,.4)" : "0 2px 8px rgba(0,0,0,.05)",
          }}
        >
          {speaking ? (
            <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
              <rect x="3" y="3" width="8" height="8" rx="1.6" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="17" viewBox="0 0 12 14" aria-hidden>
              <rect x="4" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 7a4 4 0 008 0M6 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          )}
        </button>
      )}
      <div style={{ flex: 1, background: "#fff", borderRadius: 22, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? voice?.transcript || "กำลังฟัง…" : "พิมพ์คำถาม..."}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#1a1826", background: "transparent" }}
        />
      </div>
      <button
        onClick={send}
        disabled={disabled}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `linear-gradient(135deg,${C.violet},${C.blue})`,
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(109,94,240,.35)",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          flexShrink: 0,
        }}
        aria-label="ส่งข้อความ"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M2 8l12-6-4 6 4 6-12-6z" fill="#fff" />
        </svg>
      </button>
    </div>
  );
}
