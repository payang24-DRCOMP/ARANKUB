"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, miniTile } from "./theme";
import { Empty, Legend, PairedBars, SectionTitle } from "./parts";
import { ServicesLive } from "./ServicesLive";

/**
 * หน้ารายละเอียด "รายกองทุนย่อย" ของแท็บการเงิน — ใช้ได้กับทุกกองทุนใน REP
 * (Telemedicine, ส่งยาที่บ้าน/ไปรษณีย์, กองทุนไต, และกองทุนที่มียอดเงินสูง)
 *
 * ใช้ /api/rep-funds/trend ที่มีอยู่แล้ว (หน้า /dashboard/hospital/nhso/rep-funds ใช้ตัวเดียวกัน)
 * เทียบ 2 ฝั่งเสมอ: คีย์บิลใน HosXP (เฉพาะกองทุนที่ยืนยัน icode แล้ว) vs สปสช. ยืนยันจ่ายใน REP
 * ส่วนต่างคือเคสที่ให้บริการแล้วแต่ยังไม่ได้เงิน — กองทุนที่ยังไม่มี icode จะเห็นเฉพาะฝั่ง REP
 */

interface TrendMonth {
  month: string;
  hosxpPrimary: number;
  hosxpSecondary: number;
  hosxpAmount: number;
  repCases: number;
  repPass: number;
  repAmount: number;
  gap: number;
}

interface TrendRes {
  fund: string;
  hosxpAvailable: boolean;
  icodeMapping: { code: string; label: string }[] | null;
  monthly: TrendMonth[];
  totals: { hosxpPrimary: number; hosxpSecondary: number; hosxpAmount: number; repCases: number; repAmount: number; gap: number };
  momGrowth: number | null;
}

/** คำโปรยของกองทุนที่เทียบ HosXP ได้ (มี icode ยืนยันแล้ว) */
const FUND_DESC: Record<string, string> = {
  TELEMED: "แพทย์ทางไกล · เภสัชทางไกล",
  DRUG_DELIVERY: "ไรเดอร์ · ไปรษณีย์",
};

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (ym: string) => {
  const [, m] = ym.split("-").map(Number);
  return TH_MONTH[m - 1] ?? ym;
};

export function FundDetailScreen({
  fund,
  label,
  cases,
  approved,
  cardStyle,
  onAsk,
}: {
  fund: string;
  label: string;
  /** ยอดสะสมปีงบจาก REP — ใช้เป็นบรรทัดสรุปของกองทุนที่ไม่มี icode ให้เทียบ HosXP */
  cases?: number;
  approved?: number;
  cardStyle: CSSProperties;
  onAsk: (p: string) => void;
}) {
  const [data, setData] = useState<Record<string, TrendRes>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading((prev) => prev || !data[fund]);
    // ดึงใหม่เมื่อสลับกองทุน แล้ว cache ไว้ใน state — สลับกลับมาไม่ต้องรอ
    fetch(`/api/rep-funds/trend?fund=${encodeURIComponent(fund)}&months=12`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TrendRes | null) => {
        if (cancelled) return;
        if (d) setData((prev) => ({ ...prev, [fund]: d }));
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund]);

  const cur = data[fund];
  const desc = FUND_DESC[fund] ?? `รหัสกองทุน ${fund} ใน REP`;
  // กองทุนที่ยังไม่ได้ยืนยัน icode ของ HosXP เทียบ "ให้บริการ vs ได้เงิน" ไม่ได้ — แสดงเฉพาะฝั่ง REP
  const compare = !!cur?.icodeMapping && cur.hosxpAvailable;

  return (
    <>
      <ServicesLive cardStyle={cardStyle} fund={fund} />

      {!cur ? (
        <Empty>{loading ? "กำลังโหลดข้อมูลบริการ…" : "ไม่มีข้อมูลบริการนี้"}</Empty>
      ) : (
        <>
          {/* สรุปยอด */}
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionTitle
              right={
                cur.momGrowth !== null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: cur.momGrowth >= 0 ? C.good : C.bad,
                      background: cur.momGrowth >= 0 ? "#e7f6ee" : "#fdecee",
                      padding: "4px 9px",
                      borderRadius: 100,
                    }}
                  >
                    {cur.momGrowth >= 0 ? "↑" : "↓"} {Math.abs(cur.momGrowth)}% จากเดือนก่อน
                  </span>
                )
              }
            >
              {label}
            </SectionTitle>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>{desc} · 12 เดือนล่าสุด</div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ ...bigNum, fontSize: 28, letterSpacing: "-.9px" }}>
                {compare ? fmt(cur.totals.hosxpPrimary) : baht(cur.totals.repAmount)}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                {compare ? "ครั้งที่ให้บริการ (คีย์บิลใน HosXP)" : "ยอดที่ สปสช. ยืนยันจ่าย 12 เดือน"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>สปสช. ยืนยันจ่าย</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.good }}>{fmt(cur.totals.repCases)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{baht(cur.totals.repAmount)}</div>
              </div>
              {compare ? (
                <div style={miniTile}>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ยังไม่ได้เงิน</div>
                  <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: cur.totals.gap > 0 ? C.bad : C.good }}>
                    {fmt(cur.totals.gap)}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>
                    {cur.totals.hosxpPrimary > 0 ? `${Math.round((cur.totals.gap / cur.totals.hosxpPrimary) * 100)}% ของที่ให้บริการ` : "-"}
                  </div>
                </div>
              ) : (
                <div style={miniTile}>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>เฉลี่ยต่อเคส</div>
                  <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>
                    {cur.totals.repCases > 0 ? baht(Math.round(cur.totals.repAmount / cur.totals.repCases)) : "-"}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>จากยอดที่ได้รับจริง</div>
                </div>
              )}
              {compare && cur.totals.hosxpSecondary > 0 && (
                <div style={miniTile}>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>{cur.icodeMapping?.[1]?.label ?? "บริการเสริม"}</div>
                  <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{fmt(cur.totals.hosxpSecondary)}</div>
                  <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>ครั้ง</div>
                </div>
              )}
              {typeof cases === "number" && typeof approved === "number" && (
                <div style={miniTile}>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>สะสมปีงบนี้</div>
                  <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{baht(approved)}</div>
                  <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(cases)} รายการ</div>
                </div>
              )}
            </div>
          </div>

          {/* กราฟเทียบ ให้บริการ vs ได้เงิน */}
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>รายเดือน · หน่วย: ครั้ง</span>}>
              {compare ? "ให้บริการ เทียบ ได้รับเงิน" : "ปริมาณการเบิกรายเดือน"}
            </SectionTitle>
            <PairedBars
              data={cur.monthly.map((m) => ({ label: monthLabel(m.month), a: compare ? m.hosxpPrimary : m.repCases, b: compare ? m.repCases : m.repPass }))}
              height={162}
              barWidth={9}
              colors={["linear-gradient(180deg,#a78bfa,#6D5EF0)", "linear-gradient(180deg,#7fd6b8,#2f9e6f)"]}
              showValues
              seriesLabels={compare ? ["คีย์บิลใน HosXP", "สปสช. ยืนยันจ่าย"] : ["ส่งเบิกใน REP", "ผ่านการตรวจสอบ"]}
            />
            <Legend
              items={
                compare
                  ? [{ label: "คีย์บิลใน HosXP", color: C.primary }, { label: "สปสช. ยืนยันจ่าย", color: "#2f9e6f" }]
                  : [{ label: "ส่งเบิกใน REP", color: C.primary }, { label: "ผ่านการตรวจสอบ", color: "#2f9e6f" }]
              }
            />
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
              เดือนล่าสุดยอด สปสช. มักต่ำกว่าเพราะยังไม่ถึงรอบส่งเบิก/นำเข้า REP — ไม่ใช่การถูกปฏิเสธ
            </div>
          </div>

          {/* ตารางรายเดือน */}
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ยอดเงินที่ได้รับจริง</span>}>รายละเอียดรายเดือน</SectionTitle>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 320 }}>
                <thead>
                  <tr style={{ color: C.faint, fontSize: 10 }}>
                    <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>เดือน</th>
                    {compare && <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ให้บริการ</th>}
                    <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>{compare ? "ได้เงิน" : "รายการ"}</th>
                    <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ยอดเงิน</th>
                    {compare ? (
                      <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ค้าง</th>
                    ) : (
                      <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ผ่าน</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {cur.monthly.map((m) => (
                    <tr key={m.month} style={{ borderTop: "1px solid rgba(109,94,240,.1)" }}>
                      <td style={{ padding: "7px 4px", color: C.ink2 }}>{monthLabel(m.month)}</td>
                      {compare && (
                        <td style={{ padding: "7px 4px", textAlign: "right", fontFamily: POPPINS, fontWeight: 600, color: C.ink }}>{fmt(m.hosxpPrimary)}</td>
                      )}
                      <td style={{ padding: "7px 4px", textAlign: "right", color: C.good, fontWeight: 600 }}>{fmt(m.repCases)}</td>
                      <td style={{ padding: "7px 4px", textAlign: "right", color: C.body }}>{m.repAmount > 0 ? baht(m.repAmount) : "-"}</td>
                      {compare ? (
                        <td style={{ padding: "7px 4px", textAlign: "right", color: m.gap > 0 ? C.bad : C.faint, fontWeight: m.gap > 0 ? 600 : 400 }}>
                          {m.gap > 0 ? fmt(m.gap) : "-"}
                        </td>
                      ) : (
                        <td style={{ padding: "7px 4px", textAlign: "right", color: C.body }}>{fmt(m.repPass)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!compare && (
              <div style={{ fontSize: 10, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                กองทุนนี้ยังไม่ได้ยืนยันรหัสค่าบริการ (icode) ของ HosXP จึงเทียบ &quot;คีย์บิลแล้วแต่ยังไม่ได้เงิน&quot; ไม่ได้ — ตัวเลขทั้งหมดมาจากไฟล์ REP ของ สปสช.
              </div>
            )}
            {cur.icodeMapping && (
              <div style={{ fontSize: 10, color: C.faint, marginTop: 10 }}>
                นับจากรหัสค่าบริการ {cur.icodeMapping.map((i) => `${i.code} (${i.label})`).join(", ")}
              </div>
            )}
          </div>

          {cur.totals.gap > 0 && compare ? (
            <button
              onClick={() =>
                onAsk(
                  `บริการ ${label} ให้บริการไป ${cur.totals.hosxpPrimary} ครั้งใน 12 เดือน แต่ สปสช. ยืนยันจ่ายแค่ ` +
                    `${cur.totals.repCases} ครั้ง (${baht(cur.totals.repAmount)}) เหลือค้าง ${cur.totals.gap} ครั้ง ` +
                    `ช่วยวิเคราะห์สาเหตุที่เป็นไปได้และแนวทางตามเก็บเงินให้หน่อย`
                )
              }
              style={{
                marginBottom: 20,
                background: C.primary,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: 100,
                cursor: "pointer",
              }}
            >
              ให้ AI วิเคราะห์เคสที่ยังไม่ได้เงิน
            </button>
          ) : (
            <button
              onClick={() =>
                onAsk(
                  `กองทุน ${label} (รหัส ${fund}) ใน 12 เดือนล่าสุด สปสช. ยืนยันจ่าย ${cur.totals.repCases} รายการ ` +
                    `รวม ${baht(cur.totals.repAmount)} ช่วยสรุปแนวโน้มและชี้จุดที่ควรตามเก็บเงินเพิ่มให้หน่อย`
                )
              }
              style={{
                marginBottom: 20,
                background: C.primary,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: 100,
                cursor: "pointer",
              }}
            >
              ให้ AI สรุปกองทุนนี้
            </button>
          )}
        </>
      )}
    </>
  );
}
