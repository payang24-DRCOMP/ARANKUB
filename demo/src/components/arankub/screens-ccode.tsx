"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, miniTile } from "./theme";
import { AreaLine, BarRow, Empty, SectionTitle } from "./parts";
import type { CcodeData } from "./types";

/**
 * รายงานสรุป "การติด C" — รหัสที่ สปสช. ใช้ตัด/ปฏิเสธการจ่ายในไฟล์ REP ของปีงบปัจจุบัน
 * ดูได้ว่าเสียเงินไปกับรหัสไหน เดือนไหนหนัก กองทุนย่อยไหนโดนตัดมากสุด และข้อความเตือนที่พบบ่อย
 */
export function CcodeScreen({ cardStyle, onAsk }: { cardStyle: CSSProperties; onAsk: (p: string) => void }) {
  const [data, setData] = useState<CcodeData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/arankub/ccode")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CcodeData | null) => (d ? setData(d) : setError(true)))
      .catch(() => setError(true));
  }, []);

  if (error) return <Empty>ดึงรายงานการติด C ไม่สำเร็จ</Empty>;
  if (!data) return <Empty>กำลังรวบรวมรายการที่ถูกตัดจากไฟล์ REP…</Empty>;

  const { totals } = data;
  const codeMax = Math.max(...data.codes.map((c) => c.loss), 1);
  const fundMax = Math.max(...data.funds.map((f) => f.loss), 1);
  const monthMax = Math.max(...data.months.map((m) => m.loss), 1);

  return (
    <>
      {/* สรุปยอด */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>{data.period.label}</span>}>ภาพรวมการถูกตัดจ่าย</SectionTitle>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ ...bigNum, fontSize: 28, letterSpacing: "-.9px", color: totals.loss > 0 ? C.bad : C.good }}>{baht(totals.loss)}</span>
          <span style={{ fontSize: 12, color: C.muted }}>ส่วนต่างที่ยังไม่ได้รับจากยอดที่ส่งเบิก</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={miniTile}>
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ส่งเบิก</div>
            <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{baht(totals.claimed)}</div>
            <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(totals.records)} รายการ</div>
          </div>
          <div style={miniTile}>
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ได้รับจริง</div>
            <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.good }}>{baht(totals.approved)}</div>
            <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{totals.passRate}% ของที่ส่งเบิก</div>
          </div>
          <div style={miniTile}>
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>รายการติด C</div>
            <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.bad }}>{fmt(totals.failed)}</div>
            <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>
              {totals.records > 0 ? `${Math.round((totals.failed / totals.records) * 1000) / 10}% ของรายการ` : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* รหัส C ที่เสียเงินมากสุด */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>เรียงตามยอดเงินที่เสีย</span>}>รหัสที่ทำให้เสียเงินมากสุด</SectionTitle>
        {data.codes.length === 0 ? (
          <Empty>ปีงบนี้ยังไม่มีรายการที่ถูกตัด</Empty>
        ) : (
          data.codes.map((c) => (
            <div key={c.code} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: POPPINS, fontSize: 10.5, fontWeight: 700, color: C.bad, background: "rgba(255,255,255,.9)", padding: "3px 7px", borderRadius: 7, flexShrink: 0 }}>
                  {c.code}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.description || "ไม่มีคำอธิบายในคลังรหัส"}
                </span>
                <span style={{ fontFamily: POPPINS, fontSize: 11.5, fontWeight: 700, color: C.bad, flexShrink: 0 }}>{baht(c.loss)}</span>
              </div>
              <div style={{ height: 7, background: C.track, borderRadius: 100, overflow: "hidden" }}>
                <div style={{ width: `${(c.loss / codeMax) * 100}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#e8748a,#d1495b)" }} />
              </div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>
                {fmt(c.count)} รายการ · {c.pct}% ของยอดที่เสียทั้งหมด
                {c.fix ? ` · แนวทางแก้: ${c.fix}` : ""}
              </div>
            </div>
          ))
        )}
        {data.codes.length > 0 && (
          <button
            onClick={() =>
              onAsk(
                `สรุปรายงานการติด C ปีงบนี้: เสียเงินรวม ${Math.round(totals.loss)} บาท จาก ${totals.failed} รายการ ` +
                  `รหัสที่เสียมากสุดคือ ${data.codes
                    .slice(0, 6)
                    .map((c) => `${c.code} ${c.description || ""} ${Math.round(c.loss)} บาท (${c.count} รายการ)`)
                    .join("; ")} ช่วยจัดลำดับความสำคัญและเสนอแนวทางแก้ไขให้หน่อย`
              )
            }
            style={{ marginTop: 4, background: C.primary, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 100, cursor: "pointer" }}
          >
            ให้ AI จัดลำดับแนวทางแก้ไข
          </button>
        )}
      </div>

      {/* แนวโน้มรายเดือน */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>รายเดือน · ปีงบนี้</span>}>เดือนไหนถูกตัดมากสุด</SectionTitle>
        {data.months.length === 0 ? (
          <Empty>ยังไม่มีข้อมูลรายเดือน</Empty>
        ) : (
          <>
            {/* เส้น = ยอดเงินที่เสียรายเดือน (หน่วยบาท) — จำนวนรายการดูได้ในตารางใต้กราฟ */}
            <AreaLine id="ark-ccode" values={data.months.map((m) => m.loss)} height={110} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: C.faint }}>{data.months[0]?.label}</span>
              <span style={{ fontSize: 10, color: C.faint }}>สูงสุด {baht(monthMax)}</span>
              <span style={{ fontSize: 10, color: C.faint }}>{data.months.at(-1)?.label}</span>
            </div>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 300 }}>
                <thead>
                  <tr style={{ color: C.faint, fontSize: 10 }}>
                    <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>เดือน</th>
                    <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>รายการติด C</th>
                    <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>ยอดเงินที่เสีย</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.ym} style={{ borderTop: "1px solid rgba(109,94,240,.1)" }}>
                      <td style={{ padding: "7px 4px", color: C.ink2 }}>{m.label}</td>
                      <td style={{ padding: "7px 4px", textAlign: "right", fontFamily: POPPINS, fontWeight: 600, color: C.ink }}>{fmt(m.failed)}</td>
                      <td style={{ padding: "7px 4px", textAlign: "right", color: m.loss > 0 ? C.bad : C.faint, fontWeight: 600 }}>{m.loss > 0 ? baht(m.loss) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* กองทุนย่อยที่โดนตัดมากสุด */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ยอดเงินที่เสีย</span>}>กองทุนย่อยที่ถูกตัดมากสุด</SectionTitle>
        {data.funds.length === 0 ? (
          <Empty>ยังไม่มีรายการที่ถูกตัดในกองทุนย่อย</Empty>
        ) : (
          data.funds.map((f) => (
            <BarRow
              key={f.tag}
              name={f.label ? `${f.label} · ${f.tag}` : f.tag}
              right={`${baht(f.loss)} · ${fmt(f.count)} รายการ`}
              pct={(f.loss / fundMax) * 100}
              gradient="linear-gradient(90deg,#e8748a,#d1495b)"
            />
          ))
        )}
      </div>

      {/* ข้อความเตือนที่พบบ่อย */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>พบบ่อยสุด</span>}>ข้อความที่ สปสช. แจ้งกลับ</SectionTitle>
        {data.messages.length === 0 ? (
          <Empty>ไม่มีข้อความแจ้งกลับในปีงบนี้</Empty>
        ) : (
          data.messages.map((m, i) => (
            <div key={`${m.code}-${i}`} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 11 }}>
              <span style={{ fontFamily: POPPINS, fontSize: 10.5, fontWeight: 700, color: C.bad, background: "rgba(255,255,255,.9)", padding: "3px 7px", borderRadius: 7, flexShrink: 0 }}>
                {m.code}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.ink2, lineHeight: 1.5 }}>{m.message}</span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(m.count)} ครั้ง</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
