"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, miniTile } from "./theme";
import { Empty, Legend, SectionTitle } from "./parts";
import type { SeamlessData } from "./types";

/**
 * หน้า "Seamless for DMIS" — ระบบชดเชยกองทุนโรคเฉพาะของ สปสช.
 * (ไต · วัณโรค · เอดส์ · ธาลัสซีเมีย ฯลฯ) ที่ผู้ป่วยรับบริการข้ามหน่วยบริการได้
 * แสดงยอดจากไฟล์ที่นำเข้าไว้แล้ว แยกตามกองทุนโรค ประเภทรายการ และสิทธิ
 */
export function SeamlessScreen({ cardStyle, onAsk }: { cardStyle: CSSProperties; onAsk: (p: string) => void }) {
  const [data, setData] = useState<SeamlessData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/arankub/seamless")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SeamlessData | null) => (d ? setData(d) : setError(true)))
      .catch(() => setError(true));
  }, []);

  if (error) return <Empty>ดึงข้อมูล Seamless ไม่สำเร็จ</Empty>;
  if (!data) return <Empty>กำลังโหลดข้อมูล Seamless for DMIS…</Empty>;

  /** แถวเทียบ "ได้รับชดเชย / ยอดส่งเบิก" แบบเดียวกันทุกการ์ด */
  const row = (
    key: string,
    name: string,
    sub: string,
    claimed: number,
    compensated: number,
    pending: number,
    max: number
  ) => (
    <div key={key} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
        <span style={{ fontFamily: POPPINS, fontSize: 11.5, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{baht(compensated)}</span>
      </div>
      <div style={{ position: "relative", height: 8, background: C.track, borderRadius: 100, overflow: "hidden" }}>
        <div style={{ width: `${(claimed / max) * 100}%`, height: "100%", borderRadius: 100, background: "rgba(109,94,240,.25)" }} />
        <div style={{ position: "absolute", inset: 0, width: `${(compensated / max) * 100}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#7fd6b8,#2f9e6f)" }} />
      </div>
      <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>
        {sub} · ส่งเบิก {baht(claimed)}
        {pending > 0 ? ` · ค้างชดเชย ${baht(pending)}` : ""}
      </div>
    </div>
  );

  const s = data.summary;
  const repMax = Math.max(...data.repTypes.map((r) => r.claimed), 1);
  const itemMax = Math.max(...data.items.map((i) => i.claimed), 1);
  const rightMax = Math.max(...data.rights.map((r) => r.claimed), 1);
  const denyMax = Math.max(...data.denyCodes.map((d) => d.amount), 1);

  return (
    <>
      {/* สรุปการนำเข้า */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={s && <span style={{ fontSize: 10.5, color: C.muted }}>{fmt(s.batches)} ไฟล์</span>}>
          ยอดจากการนำเข้า Seamless for DMIS
        </SectionTitle>
        {!s ? (
          <Empty>ยังไม่มีข้อมูล Seamless หรือเชื่อมต่อ hospital-api ไม่ได้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ ...bigNum, fontSize: 28, letterSpacing: "-.9px", color: C.good }}>{baht(s.compensated)}</span>
              <span style={{ fontSize: 12, color: C.muted }}>ได้รับชดเชยแล้ว ({s.rate}% ของยอดส่งเบิก)</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ส่งเบิก</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{baht(s.claimed)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(s.rows)} รายการ</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ยังไม่ได้ชดเชย</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: s.notCompensated > 0 ? C.bad : C.good }}>
                  {baht(s.notCompensated)}
                </div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(s.countNotComp)} รายการ</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ผู้ป่วย</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{fmt(s.patients)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>คนที่มีรายการชดเชย</div>
              </div>
            </div>
            {(s.payMore > 0 || s.recall > 0) && (
              <div style={{ fontSize: 10.5, color: C.faint }}>
                จ่ายเพิ่ม {baht(s.payMore)} · เรียกคืน {baht(s.recall)}
              </div>
            )}
          </>
        )}
      </div>

      {/* กองทุนโรค */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ได้รับชดเชย / ส่งเบิก</span>}>แยกตามกองทุนโรค</SectionTitle>
        {data.repTypes.length === 0 ? (
          <Empty>ยังไม่มีข้อมูลกองทุนโรค</Empty>
        ) : (
          <>
            {data.repTypes.map((r) => row(r.code, r.label, `${fmt(r.patients)} คน · ${fmt(r.cases)} รายการ`, r.claimed, r.compensated, r.pending, repMax))}
            <Legend items={[{ label: "ได้รับชดเชย", color: "#2f9e6f" }, { label: "ยอดส่งเบิก", color: "rgba(109,94,240,.35)" }]} />
          </>
        )}
      </div>

      {/* ประเภทรายการ */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>10 อันดับแรก</span>}>แยกตามประเภทรายการ</SectionTitle>
        {data.items.length === 0 ? (
          <Empty>ยังไม่มีข้อมูลรายการ</Empty>
        ) : (
          data.items.map((i) => row(i.code, i.label, `${fmt(i.patients)} คน · ${fmt(i.cases)} รายการ`, i.claimed, i.compensated, i.pending, itemMax))
        )}
      </div>

      {/* สิทธิการรักษา */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ได้รับชดเชย / ส่งเบิก</span>}>แยกตามสิทธิการรักษา</SectionTitle>
        {data.rights.length === 0 ? (
          <Empty>ยังไม่มีข้อมูลสิทธิ</Empty>
        ) : (
          data.rights.map((r) => row(r.code, r.label, `${fmt(r.patients)} คน · ${fmt(r.cases)} รายการ`, r.claimed, r.compensated, r.pending, rightMax))
        )}
      </div>

      {/* สาเหตุที่ยังไม่ได้ชดเชย */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>เรียงตามยอดเงิน</span>}>สาเหตุที่ยังไม่ได้ชดเชย</SectionTitle>
        {data.denyCodes.length === 0 ? (
          <Empty>ไม่มีรายการที่ถูกปฏิเสธการชดเชย</Empty>
        ) : (
          <>
            {data.denyCodes.map((d) => (
              <div key={d.code} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: POPPINS, fontSize: 10.5, fontWeight: 700, color: C.bad, background: "rgba(255,255,255,.9)", padding: "3px 7px", borderRadius: 7, flexShrink: 0 }}>
                    {d.code}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.description}
                  </span>
                  <span style={{ fontFamily: POPPINS, fontSize: 11.5, fontWeight: 700, color: C.bad, flexShrink: 0 }}>{baht(d.amount)}</span>
                </div>
                <div style={{ height: 7, background: C.track, borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ width: `${(d.amount / denyMax) * 100}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#e8748a,#d1495b)" }} />
                </div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>
                  {fmt(d.cases)} รายการ · {fmt(d.patients)} คน
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                onAsk(
                  `Seamless for DMIS: ยังไม่ได้ชดเชยรวม ${s?.notCompensated ?? 0} บาท สาเหตุหลักคือ ${data.denyCodes
                    .slice(0, 5)
                    .map((d) => `${d.code} ${d.description} ${d.amount} บาท (${d.cases} รายการ)`)
                    .join("; ")} ช่วยสรุปว่าควรแก้ที่ขั้นตอนไหนก่อน`
                )
              }
              style={{ marginTop: 4, background: C.primary, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 100, cursor: "pointer" }}
            >
              ให้ AI วิเคราะห์แนวทางตามเก็บเงิน
            </button>
          </>
        )}
      </div>

      {/* ไฟล์ที่นำเข้าล่าสุด */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ล่าสุด 6 ไฟล์</span>}>การนำเข้าล่าสุด</SectionTitle>
        {data.imports.length === 0 ? (
          <Empty>ยังไม่มีประวัติการนำเข้า</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 320 }}>
              <thead>
                <tr style={{ color: C.faint, fontSize: 10 }}>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>กองทุน</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>รายการ</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ได้รับชดเชย</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>นำเข้าเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((i) => (
                  <tr key={i.repNo} style={{ borderTop: "1px solid rgba(109,94,240,.1)" }}>
                    <td style={{ padding: "7px 4px", color: C.ink2 }}>
                      {i.label}
                      <div style={{ fontSize: 9.5, color: C.faint }}>{i.repNo}</div>
                    </td>
                    <td style={{ padding: "7px 4px", textAlign: "right", fontFamily: POPPINS, fontWeight: 600, color: C.ink }}>{fmt(i.rows)}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", color: C.good, fontWeight: 600 }}>{baht(i.compensated)}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", color: C.faint, fontSize: 10.5 }}>{i.importDate ?? i.reportDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
