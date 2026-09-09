"use client";

import type { CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, miniTile } from "./theme";
import { AreaLine, Donut, Empty, KpiCard, Legend, PairedBars, SectionTitle, donutColor } from "./parts";
import type { FinanceData } from "./types";

const KPI_DOTS = [C.violet, C.blue, C.primary, C.lilac];

export function FinanceScreen({
  data,
  cardStyle,
  onAsk,
}: {
  data: FinanceData | null;
  cardStyle: CSSProperties;
  onAsk: (prompt: string) => void;
}) {
  if (!data) return <Empty>กำลังโหลดข้อมูลการเงิน…</Empty>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {data.kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} color={KPI_DOTS[i]} style={{ ...cardStyle, padding: 15 }} />
        ))}
      </div>

      {/* รายได้ตามกองทุน */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>{data.period.label}</span>}>รายได้ตามกองทุน</SectionTitle>
        {data.funds.length === 0 ? (
          <Empty>เชื่อมต่อ hospital-api (:8000) ไม่ได้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <Donut
                data={data.funds.map((f) => ({ label: f.label, pct: f.pct }))}
                total={data.fundTotal}
                size={104}
                centerValue={(data.fundTotal / 1_000_000).toFixed(1)}
                centerUnit="ล้านบาท"
              />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.funds.slice(0, 5).map((f, i) => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: donutColor(i), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "#4a4658", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.label}
                    </span>
                    <span style={{ fontFamily: POPPINS, fontSize: 11, fontWeight: 700, color: C.ink }}>{baht(f.income)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.faint }}>ยอดรวม {baht(data.fundTotal)} จาก {fmt(data.funds.reduce((s, f) => s + f.visits, 0))} ครั้งบริการ</div>
          </>
        )}
      </div>

      {/* REP เบิก vs ได้รับ */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={data.rep && <span style={{ fontSize: 10.5, color: C.muted }}>{data.rep.periods.length} งวด</span>}>
          ผลตรวจสอบ REP — เบิก / ได้รับจริง
        </SectionTitle>
        {!data.rep ? (
          <Empty>ยังไม่มีข้อมูล REP หรือเชื่อมต่อ hospital-api ไม่ได้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ส่งเบิก</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{baht(data.rep.claimed)}</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ได้รับจริง</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.good }}>{baht(data.rep.approved)}</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ส่วนต่าง</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.bad }}>{baht(data.rep.loss)}</div>
              </div>
            </div>
            <PairedBars
              data={data.rep.periods.map((p) => ({ label: p.label.split(" ")[0], a: p.claimed, b: p.approved }))}
              height={140}
              barWidth={9}
              colors={["linear-gradient(180deg,#a78bfa,#6D5EF0)", "linear-gradient(180deg,#7fd6b8,#2f9e6f)"]}
              seriesLabels={["ส่งเบิก", "ได้รับจริง"]}
            />
            <Legend items={[{ label: "ส่งเบิก", color: C.primary }, { label: "ได้รับจริง", color: "#2f9e6f" }]} />
            <div style={{ position: "relative", height: 9, background: C.track, borderRadius: 100, marginTop: 14 }}>
              <div style={{ width: `${Math.min(data.rep.passRate, 100)}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#7fd6b8,#2f9e6f)" }} />
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 6 }}>ได้รับจริง {data.rep.passRate}% ของยอดที่ส่งเบิกทั้งหมด</div>
          </>
        )}
      </div>

      {/* ส่งยาที่บ้าน */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={data.rider && <span style={{ fontSize: 10.5, color: C.muted }}>ปีงบ {data.rider.fy}</span>}>ค่าส่งยาที่บ้าน (ไรเดอร์)</SectionTitle>
        {!data.rider ? (
          <Empty>ยังไม่มีเคสส่งยาในปีงบนี้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <span style={{ ...bigNum, fontSize: 26, letterSpacing: "-.8px" }}>{baht(data.rider.claimAmount)}</span>
              <span style={{ fontSize: 11.5, color: C.muted }}>ยอดเบิกสะสม</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ออกส่งจริง</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{fmt(data.rider.sent)}</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ยังไม่ลงเบิก</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: data.rider.missed > 0 ? C.bad : C.good }}>{fmt(data.rider.missed)}</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>เคสทั้งหมด</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{fmt(data.rider.cases)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* แนวโน้ม 12 เดือน */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>12 เดือนล่าสุด</span>}>แนวโน้มรายรับและปริมาณงาน</SectionTitle>
        {data.trend.length === 0 ? (
          <Empty>เชื่อมต่อ hospital-api ไม่ได้</Empty>
        ) : (
          <>
            <AreaLine id="ark-fin" values={data.trend.map((t) => t.income ?? 0)} height={104} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.faint }}>{data.trend[0]?.label}</span>
              <span style={{ fontSize: 10, color: C.faint }}>{data.trend[Math.floor(data.trend.length / 2)]?.label}</span>
              <span style={{ fontSize: 10, color: C.faint }}>{data.trend.at(-1)?.label}</span>
            </div>
            <div style={{ fontSize: 10.5, color: C.faint }}>เส้นแสดงรายรับผู้ป่วยนอกรายเดือน (บาท) จากคลังข้อมูลที่ sync จาก HosXP</div>
          </>
        )}
        <button
          onClick={() =>
            onAsk(
              `สรุปภาพรวมการเงินให้หน่อย: ค่ารักษาเดือนนี้แยกตามสิทธิ ${data.funds
                .map((f) => `${f.label} ${Math.round(f.income)} บาท`)
                .join(", ")}` +
                (data.rep
                  ? ` · REP สะสมส่งเบิก ${Math.round(data.rep.claimed)} บาท ได้รับจริง ${Math.round(data.rep.approved)} บาท ถูกตัด ${Math.round(data.rep.loss)} บาท`
                  : "") +
                " ชี้จุดที่ควรตามเก็บเงินและแนวโน้มที่น่ากังวลด้วย"
            )
          }
          style={{ marginTop: 14, background: C.primary, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 100, cursor: "pointer" }}
        >
          ให้ AI สรุปภาพรวมการเงิน
        </button>
      </div>
    </>
  );
}

/* ================================================== ทำเนียบกองทุนย่อย (REP) */

/**
 * จัดกลุ่มรหัสกองทุนย่อยตามลักษณะของบริการ — ใช้ prefix/คำสำคัญของรหัสเป็นเกณฑ์
 * (กฎแรกที่ตรงชนะ) รหัสที่ไม่เข้ากลุ่มไหนจะไปอยู่ "อื่น ๆ"
 */
const FUND_GROUPS: { name: string; match: (t: string) => boolean }[] = [
  { name: "บริการทางไกล · ส่งยา", match: (t) => t.startsWith("TELEMED") || t.startsWith("DRUG_DELIVERY") },
  { name: "ไต · ฟอกเลือด", match: (t) => t.includes("HD-ODS") || t.includes("-HD") },
  { name: "อุปกรณ์ · ผ่าตัด", match: (t) => t.startsWith("INST") || t.startsWith("OPINST") || t.startsWith("CAT") || t === "DENTURE" },
  { name: "ผู้ป่วยใน", match: (t) => t.startsWith("IP") },
  { name: "อุบัติเหตุ · ฉุกเฉิน", match: (t) => t.startsWith("UCEP") || t.startsWith("OPAE") || t.startsWith("ONTOP-ER") || t.startsWith("CAR") },
  { name: "ยา · เวชภัณฑ์", match: (t) => t.includes("DRUG") || t.startsWith("HERB") || t.startsWith("CLOPIDOGREL") || t.startsWith("STEMI") || t.startsWith("STROKE") },
  { name: "ส่งเสริมสุขภาพ · แม่และเด็ก", match: (t) => t.startsWith("ANC") || t.startsWith("PP_") || t === "FPNHSO" || t.startsWith("DM_") || t.startsWith("SPECC") || t.startsWith("SCREENING") },
  { name: "โรคเฉพาะ · ประคับประคอง", match: (t) => t.startsWith("CANCER") || t.startsWith("PALLIATIVE") || t.startsWith("DMIS") },
  { name: "ผู้ป่วยนอกทั่วไป", match: (t) => t.startsWith("OP") || t.startsWith("WALKIN") },
];

const groupOf = (tag: string) => FUND_GROUPS.find((g) => g.match(tag))?.name ?? "อื่น ๆ";

/**
 * หน้า "กองทุนย่อย" — ทำเนียบกองทุนทั้งหมดจากไฟล์ REP ที่นำเข้า จัดกลุ่มตามประเภทบริการ
 * คลิกที่กองทุนไหนก็เปิดหน้ารายละเอียดของกองทุนนั้น
 */
export function FundsDirectory({
  data,
  cardStyle,
  onOpen,
}: {
  data: FinanceData | null;
  cardStyle: CSSProperties;
  onOpen: (tag: string) => void;
}) {
  if (!data) return <Empty>กำลังโหลดข้อมูลการเงิน…</Empty>;
  if (data.fundMenu.length === 0) return <Empty>ยังไม่มีกองทุนย่อยในไฟล์ REP ของปีงบนี้</Empty>;

  const groups = FUND_GROUPS.map((g) => g.name)
    .concat("อื่น ๆ")
    .map((name) => ({
      name,
      funds: data.fundMenu.filter((f) => groupOf(f.tag) === name),
    }))
    .filter((g) => g.funds.length > 0)
    .map((g) => ({
      ...g,
      approved: g.funds.reduce((s, f) => s + f.approved, 0),
      claimed: g.funds.reduce((s, f) => s + f.claimed, 0),
      cases: g.funds.reduce((s, f) => s + f.cases, 0),
    }))
    .sort((a, b) => b.approved - a.approved);

  const totalApproved = groups.reduce((s, g) => s + g.approved, 0);

  return (
    <>
      {/* ยอดรวมจากไฟล์ REP ที่นำเข้า */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={data.rep && <span style={{ fontSize: 10.5, color: C.muted }}>{data.rep.periodCount} งวด</span>}>
          ยอดจากการนำเข้าไฟล์ REP
        </SectionTitle>
        {!data.rep ? (
          <Empty>ยังไม่มีข้อมูล REP หรือเชื่อมต่อ hospital-api ไม่ได้</Empty>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ ...bigNum, fontSize: 28, letterSpacing: "-.9px", color: C.good }}>{baht(data.rep.approved)}</span>
              <span style={{ fontSize: 12, color: C.muted }}>ได้รับจริงสะสมจากทุกงวดที่นำเข้า</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ส่งเบิก</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{baht(data.rep.claimed)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(data.rep.records)} รายการ</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ไฟล์ที่นำเข้า</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.ink }}>{fmt(data.rep.files)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>งวดล่าสุด {data.rep.lastPeriod || "-"}</div>
              </div>
              <div style={miniTile}>
                <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ถูกตัด</div>
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 15, color: C.bad }}>{baht(data.rep.loss)}</div>
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{fmt(data.rep.fail)} รายการไม่ผ่าน</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.faint }}>
              นำเข้าล่าสุด {data.rep.lastImport ?? "-"} · ตัวเลขกองทุนย่อยด้านล่างคิดเฉพาะปีงบ {data.fy}
            </div>
          </>
        )}
      </div>

      {/* กองทุนย่อยแยกตามประเภท */}
      {groups.map((g) => {
        const max = Math.max(...g.funds.map((f) => f.approved), 1);
        return (
          <div key={g.name} style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionTitle
              right={
                <span style={{ fontSize: 10.5, color: C.muted }}>
                  {totalApproved > 0 ? `${Math.round((g.approved / totalApproved) * 100)}%` : "-"} ของยอดกองทุนย่อย
                </span>
              }
            >
              {g.name}
            </SectionTitle>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
              {baht(g.approved)} จาก {fmt(g.cases)} รายการ · {g.funds.length} กองทุน
            </div>
            {g.funds.map((f) => (
              <div
                key={f.tag}
                onClick={() => onOpen(f.tag)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(f.tag)}
                style={{ marginBottom: 11, cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.label || f.tag}
                    {f.label && <span style={{ fontSize: 10, color: C.faint }}> · {f.tag}</span>}
                  </span>
                  <span style={{ fontFamily: POPPINS, fontSize: 11.5, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{baht(f.approved)}</span>
                </div>
                <div style={{ height: 7, background: C.track, borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ width: `${(f.approved / max) * 100}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#8B5CF6,#6D5EF0)" }} />
                </div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>
                  ส่งเบิก {baht(f.claimed)} · {fmt(f.cases)} รายการ · แตะเพื่อดูรายละเอียด
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
