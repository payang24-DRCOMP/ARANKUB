"use client";

import { useState, type CSSProperties } from "react";
import { C, POPPINS, baht, bigNum, fmt, glass, miniTile, segment } from "./theme";
import { BarRow, Empty, KpiCard, Legend, OverlayBars, Orb, PairedBars, SectionTitle } from "./parts";
import { BedSettingsButton, BedSettingsModal } from "./BedSettings";
import type { DashboardData, IpdData, OpdData, Overview } from "./types";

const KPI_DOTS = [C.violet, C.blue, C.primary, C.lilac];

export function ModuleSegments({ module, onChange, style }: { module: string; onChange: (m: string) => void; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", ...style }}>
      <div style={segment(module === "opd")} onClick={() => onChange("opd")}>OPD</div>
      <div style={segment(module === "all")} onClick={() => onChange("all")}>ภาพรวม</div>
      <div style={segment(module === "ipd")} onClick={() => onChange("ipd")}>IPD</div>
    </div>
  );
}

/* ---------------------------------------------------------------- OPD card */

export function OpdTodayCard({ ov, cardStyle }: { ov: Overview; cardStyle: CSSProperties }) {
  const pct = Math.min(Math.round((ov.opdToday / Math.max(ov.opdTarget, 1)) * 100), 100);
  return (
    <div style={cardStyle}>
      <SectionTitle
        right={
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: ov.opdToday >= ov.opdYesterday ? C.good : C.bad,
              background: ov.opdToday >= ov.opdYesterday ? "#e7f6ee" : "#fdecee",
              padding: "4px 9px",
              borderRadius: 100,
            }}
          >
            {ov.opdDelta}
          </span>
        }
      >
        ผู้ป่วย OPD วันนี้
      </SectionTitle>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...bigNum, fontSize: 32 }}>{fmt(ov.opdToday)}</span>
          <span style={{ fontSize: 12.5, color: C.muted }}>ราย</span>
        </div>
        <span style={{ fontSize: 11, color: C.muted, paddingBottom: 5, textAlign: "right" }}>
          ค่าเฉลี่ยวันเดียวกัน {fmt(ov.opdTarget)} ราย
        </span>
      </div>

      <div style={{ position: "relative", height: 9, background: C.track, borderRadius: 100, marginBottom: 14 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#8B5CF6,#4C6FFF)", borderRadius: 100 }} />
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 15,
            height: 15,
            borderRadius: "50%",
            background: "#fff",
            border: `3px solid ${C.primary}`,
            boxShadow: "0 2px 8px rgba(109,94,240,.45)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ตรวจเสร็จ</div>
          <Stat value={ov.live ? fmt(ov.opdDone) : "—"} unit="ราย" />
        </div>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>ยังอยู่ในระบบ</div>
          <Stat value={ov.live ? fmt(ov.opdPending) : "—"} unit="ราย" />
        </div>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>รับไว้รักษา</div>
          <Stat value={fmt(ov.admittedToday)} unit="ราย" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, unit, color = C.ink }: { value: string; unit: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color }}>{value}</span>
      <span style={{ fontSize: 10, color: C.muted }}>{unit}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- IPD card */

export function IpdSummaryCard({
  ov,
  cardStyle,
  onOpenIpd,
}: {
  ov: Overview;
  cardStyle: CSSProperties;
  onOpenIpd: () => void;
}) {
  return (
    <div style={cardStyle}>
      <SectionTitle
        right={
          <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, background: "#f1edfd", padding: "4px 9px", borderRadius: 100 }}>
            ครองเตียง {ov.ipdOccupancyPct}%
          </span>
        }
      >
        ผู้ป่วยใน (IPD)
      </SectionTitle>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 11, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...bigNum, fontSize: 32 }}>{fmt(ov.ipdCensus)}</span>
          <span style={{ fontSize: 12.5, color: C.muted }}>ราย คงรักษา</span>
        </div>
        <span style={{ fontSize: 11, color: C.muted, paddingBottom: 5 }}>LOS เฉลี่ย {ov.ipdAvgLos || "-"} วัน</span>
      </div>

      <div style={{ display: "flex", height: 9, gap: 3, marginBottom: 14 }}>
        <div style={{ width: `${Math.min(ov.ipdOccupancyPct, 100)}%`, background: "linear-gradient(90deg,#8B5CF6,#4C6FFF)", borderRadius: 100 }} />
        <div style={{ flex: 1, background: C.track, borderRadius: 100 }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>เตียงว่าง</div>
          <Stat value={fmt(ov.ipdFreeBeds)} unit="เตียง" color={C.good} />
        </div>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>รับใหม่</div>
          <Stat value={fmt(ov.ipdAdmitToday)} unit="ราย" />
        </div>
        <div style={miniTile}>
          <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>จำหน่าย</div>
          <Stat value={fmt(ov.ipdDischargeToday)} unit="ราย" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {ov.wardsTop.slice(0, 3).map((w) => (
          <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{ width: 88, flexShrink: 0, fontSize: 11.5, color: C.ink2, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {w.name}
            </span>
            <div style={{ flex: 1, height: 7, background: C.track, borderRadius: 100, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(w.pct, 100)}%`,
                  height: "100%",
                  borderRadius: 100,
                  background: w.pct >= 85 ? "linear-gradient(90deg,#e8748a,#d1495b)" : "linear-gradient(90deg,#8B5CF6,#4C6FFF)",
                }}
              />
            </div>
            <span style={{ width: 44, textAlign: "right", fontSize: 11, color: C.body, flexShrink: 0 }}>
              {w.occupied}/{w.beds}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,.8)" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, cursor: "pointer" }} onClick={onOpenIpd}>
          ดูหน้า IPD →
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- hero orb */

export function HeroOrb({
  ov,
  size,
  orbSize,
  listening,
  onOrbClick,
}: {
  ov: Overview;
  size: number;
  orbSize: number;
  listening: boolean;
  onOrbClick: () => void;
}) {
  const half = size / 2;
  const chip = (label: string, value: string, color: string, pos: CSSProperties) => (
    <div
      key={label}
      style={{
        position: "absolute",
        background: "rgba(255,255,255,.75)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,.85)",
        borderRadius: 16,
        padding: "8px 11px",
        boxShadow: "0 6px 18px rgba(84,64,160,.1)",
        whiteSpace: "nowrap",
        ...pos,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 10, color: C.body, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{value}</div>
    </div>
  );

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <div
        style={{
          position: "absolute",
          left: half,
          top: half,
          transform: "translate(-50%,-50%)",
          width: size * 0.78,
          height: size * 0.78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(139,92,246,.28),transparent)",
          filter: "blur(22px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: half,
          top: half,
          transform: "translate(-50%,-50%)",
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: "50%",
          border: "1px dashed rgba(109,94,240,.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: half,
          top: half,
          transform: "translate(-50%,-50%)",
          width: size * 0.57,
          height: size * 0.57,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,.85)",
        }}
      />
      {/* จุดโคจรรอบวง — สองวงหมุนสวนทางกัน ให้ความรู้สึกว่า AI ยังทำงานอยู่ */}
      <div
        style={{
          position: "absolute",
          left: half,
          top: half,
          transform: "translate(-50%,-50%)",
          width: size * 0.53,
          height: size * 0.53,
          pointerEvents: "none",
        }}
      >
        <div className="ark-spin-9" style={{ position: "absolute", inset: 0 }}>
          <span
            style={{
              position: "absolute",
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: C.primary,
              boxShadow: "0 0 14px rgba(109,94,240,.95)",
            }}
          />
        </div>
        <div className="ark-spin-rev" style={{ position: "absolute", inset: 0 }}>
          <span
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.blue,
              boxShadow: "0 0 10px rgba(76,111,255,.9)",
            }}
          />
        </div>
      </div>

      {/* วงนอกอีกชั้น หมุนช้ากว่า */}
      <div
        style={{
          position: "absolute",
          left: half,
          top: half,
          transform: "translate(-50%,-50%)",
          width: size * 0.72,
          height: size * 0.72,
          pointerEvents: "none",
        }}
      >
        <div className="ark-spin-22" style={{ position: "absolute", inset: 0 }}>
          <span
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: C.lilac,
              boxShadow: "0 0 12px rgba(167,139,250,.9)",
            }}
          />
        </div>
      </div>

      {/* เส้นโยงจากป้ายตัวเลขเข้าหาวงกลม + จุดเรืองแสงปลายเส้น */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {NODES.map((n) => (
          <line
            key={n.key}
            x1={half + n.x * size}
            y1={half + n.y * size}
            x2={half + n.x * size * 0.42}
            y2={half + n.y * size * 0.42}
            stroke="rgba(109,94,240,.4)"
            strokeWidth="1"
          />
        ))}
      </svg>
      {NODES.map((n) => (
        <span
          key={n.key}
          className="ark-node"
          style={{
            position: "absolute",
            left: half + n.x * size,
            top: half + n.y * size,
            transform: "translate(-50%,-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            border: `3px solid ${n.color}`,
            boxShadow: `0 0 12px ${n.color}e6`,
            animationDelay: n.delay,
            pointerEvents: "none",
          }}
        />
      ))}

      <div style={{ position: "absolute", left: half, top: half, transform: "translate(-50%,-50%)" }}>
        <Orb size={orbSize} listening={listening} onClick={onOrbClick} />
      </div>

      {chip("ผู้ป่วยนอกวันนี้", `${fmt(ov.opdToday)} ราย`, C.violet, { left: -6, top: size * 0.1 })}
      {chip("ผู้ป่วยในคงรักษา", `${fmt(ov.ipdCensus)} ราย`, C.lilac, { right: -6, top: size * 0.1 })}
      {chip("ส่งต่อผู้ป่วยวันนี้", `${fmt(ov.referOutToday)} ราย`, C.primary, { left: -6, top: size * 0.72 })}
      {chip("ค่ารักษาวันนี้", baht(ov.incomeToday), C.blue, { right: -6, top: size * 0.72 })}
    </div>
  );
}

/** จุดเรืองแสง 4 มุม (สัดส่วนเทียบขนาดวง) — ตรงกับตำแหน่งป้ายตัวเลขทั้งสี่ */
const NODES = [
  { key: "tl", x: -0.145, y: -0.115, color: C.violet, delay: "0s" },
  { key: "tr", x: 0.15, y: -0.095, color: C.lilac, delay: ".7s" },
  { key: "bl", x: -0.145, y: 0.115, color: C.primary, delay: "1.4s" },
  { key: "br", x: 0.15, y: 0.095, color: C.blue, delay: "2.1s" },
];

/* ---------------------------------------------------------- OPD full screen */

export function OpdScreen({ opd, ov, cardStyle }: { opd: OpdData; ov: Overview; cardStyle: CSSProperties }) {
  const levelColor = { high: C.bad, medium: C.warn, low: C.good } as const;
  const peak = opd.hours.reduce((a, b) => (b.today > a.today ? b : a), opd.hours[0]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {opd.kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} color={KPI_DOTS[i]} style={{ ...cardStyle, padding: 15 }} />
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>{fmt(opd.total)} ครั้งวันนี้</span>}>ความแออัดตามแผนก</SectionTitle>
        {opd.depts.length === 0 ? (
          <Empty>ยังไม่มีผู้ป่วยนอกในระบบวันนี้</Empty>
        ) : (
          opd.depts.map((d) => (
            <BarRow
              key={d.name}
              name={d.name}
              dot={levelColor[d.level]}
              right={`${fmt(d.count)} ครั้ง`}
              pct={d.pct}
              gradient={
                d.level === "high"
                  ? "linear-gradient(90deg,#e8748a,#d1495b)"
                  : d.level === "medium"
                    ? "linear-gradient(90deg,#8B5CF6,#6D5EF0)"
                    : "linear-gradient(90deg,#a5b4fc,#4C6FFF)"
              }
            />
          ))
        )}
        <Legend items={[{ label: "สูง", color: C.bad }, { label: "กลาง", color: C.warn }, { label: "ปกติ", color: C.good }]} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink2, marginBottom: 4 }}>เวชระเบียนที่ AI ติดธง</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>ตรวจอัตโนมัติจาก 8 กติกาการลงรหัส</div>
        {opd.flagged.length === 0 ? (
          <Empty>ยังไม่พบประเด็นที่ต้องแก้ไขวันนี้</Empty>
        ) : (
          opd.flagged.map((f) => (
            <div
              key={f.name}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 16, background: "rgba(255,255,255,.72)", marginBottom: 8 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: f.severity === "high" ? C.bad : f.severity === "medium" ? C.warn : C.primary,
                }}
              />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.ink2, fontWeight: 500 }}>{f.name}</span>
              <span style={{ fontFamily: POPPINS, fontSize: 12, fontWeight: 700, color: f.severity === "high" ? C.bad : C.body }}>{fmt(f.count)}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>ชั่วโมงหนาแน่นสุด {peak?.hour}:00</span>}>
          ผู้ป่วยเข้ารับบริการรายชั่วโมง
        </SectionTitle>
        <OverlayBars
          data={opd.hours.map((h) => ({ label: `${h.hour}:00`, front: h.today, back: h.avg }))}
          height={118}
          labelEvery={3}
          seriesLabels={["วันนี้", "เฉลี่ย 30 วัน"]}
        />
        <Legend items={[{ label: "วันนี้", color: C.primary }, { label: "เฉลี่ย 30 วัน", color: "rgba(109,94,240,.35)" }]} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>วันนี้</span>}>สิทธิการรักษา (OPD)</SectionTitle>
        {opd.rights.map((r, i) => (
          <BarRow key={r.label} name={r.label} right={`${fmt(r.count)} ราย · ${r.pct}%`} pct={r.pct} gradient={`linear-gradient(90deg,${KPI_DOTS[i % 4]},#4C6FFF)`} />
        ))}
        {/* แถบสิทธิมาจาก warehouse ส่วน ov.opdToday สดจาก HosXP — ระหว่างวันสองค่านี้ต่างกันได้
            จึงสรุปจากผลรวมของแถบเอง แล้วบอกส่วนที่ยังไม่ลงรายละเอียดแยกไว้ ไม่ยัดเลขสดมาทับ */}
        {(() => {
          const shown = opd.rights.reduce((s, r) => s + r.count, 0);
          const waiting = ov.opdToday - shown;
          return (
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 4 }}>
              ยอดรวม {fmt(shown)} ครั้ง
              {waiting > 0 && ` · อีก ${fmt(waiting)} ครั้งรอ sync ลงรายละเอียด`}
            </div>
          );
        })()}
      </div>
    </>
  );
}

/* ---------------------------------------------------------- IPD full screen */

export function IpdScreen({
  ipd,
  cardStyle,
  isAdmin,
  onBedsSaved,
}: {
  ipd: IpdData;
  cardStyle: CSSProperties;
  isAdmin: boolean;
  onBedsSaved: () => void;
}) {
  const wardsUnset = ipd.wards.some((w) => !w.configured);
  const [showBeds, setShowBeds] = useState(false);
  return (
    <>
      {showBeds && (
        <BedSettingsModal
          isAdmin={isAdmin}
          onClose={() => setShowBeds(false)}
          onSaved={onBedsSaved}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {ipd.kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} color={KPI_DOTS[i]} style={{ ...cardStyle, padding: 15 }} />
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle
          right={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, color: C.muted }}>ครองเตียง / เตียงที่เปิด · LOS</span>
              <BedSettingsButton onClick={() => setShowBeds(true)} />
            </span>
          }
        >
          อัตราครองเตียงตามวอร์ด
        </SectionTitle>
        {ipd.wards.length === 0 ? (
          <Empty>เชื่อมต่อ HosXP ไม่ได้ จึงยังไม่ทราบยอดครองเตียงขณะนี้</Empty>
        ) : (
          <>
            {ipd.wards.map((w) => (
              <BarRow
                key={w.name}
                name={w.name}
                right={`${w.occupied}/${w.beds} · LOS ${w.los || "-"} ว.`}
                pct={w.pct}
                gradient={w.pct >= 85 ? "linear-gradient(90deg,#e8748a,#d1495b)" : "linear-gradient(90deg,#8B5CF6,#4C6FFF)"}
              />
            ))}
            {wardsUnset && (
              <div style={{ fontSize: 10.5, color: C.warn, marginTop: 4, lineHeight: 1.5 }}>
                ⚠ บางวอร์ดยังใช้จำนวนเตียงที่ขึ้นทะเบียนใน HosXP ซึ่งไม่ตรงกับที่เปิดจริง —{" "}
                <span onClick={() => setShowBeds(true)} style={{ color: C.primary, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                  ตั้งค่าเตียงที่เปิด
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>สมดุลการหมุนเวียนเตียง</span>}>รับใหม่ / จำหน่าย 7 วัน</SectionTitle>
        <PairedBars
          data={ipd.flow.map((f) => ({ label: f.label, a: f.admit, b: f.discharge }))}
          height={134}
          seriesLabels={["รับใหม่", "จำหน่าย"]}
        />
        <Legend items={[{ label: "รับใหม่", color: C.primary }, { label: "จำหน่าย", color: C.blue }]} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>90 วันล่าสุด</span>}>โรคหลักที่รับไว้รักษามาก</SectionTitle>
        {ipd.diagnoses.length === 0 ? (
          <Empty>ยังไม่มีเคสผู้ป่วยในที่ลงรหัส ICD-10 แล้วในช่วง 90 วัน</Empty>
        ) : (
          ipd.diagnoses.map((d) => (
            <div key={d.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.72)" }}>
              <span
                style={{
                  fontFamily: POPPINS,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: C.primary,
                  background: "rgba(255,255,255,.85)",
                  padding: "4px 7px",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                {d.code}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ fontSize: 11.5, color: C.body, flexShrink: 0 }}>{fmt(d.count)}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1826", marginBottom: 3 }}>ภาระงานผู้ป่วยในเดือนนี้</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <span style={{ ...bigNum, fontSize: 26, letterSpacing: "-.8px" }}>{fmt(ipd.month.bedDays)}</span>
          <span style={{ fontSize: 11.5, color: C.muted }}>วันนอนรวม จาก {fmt(ipd.month.cases)} เคสที่จำหน่าย</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={miniTile}>
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>LOS เฉลี่ยเดือนนี้</div>
            <Stat value={ipd.month.avgLos ? ipd.month.avgLos.toFixed(1) : "-"} unit="วัน" />
          </div>
          <div style={miniTile}>
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>จัดกลุ่ม DRG แล้ว</div>
            <Stat value={fmt(ipd.month.drgGrouped)} unit={`/${fmt(ipd.month.cases)} เคส`} />
          </div>
        </div>
        {ipd.month.drgGrouped > 0 && (
          <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10 }}>AdjRW รวมของเคสที่จัดกลุ่มแล้ว {ipd.month.adjRwSum.toLocaleString("th-TH")}</div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------ overview (mobile) */

export function OverviewMobile({
  data,
  module,
  setModule,
  listening,
  onOrbClick,
  voiceText,
  onOpenChat,
}: {
  data: DashboardData;
  module: string;
  setModule: (m: string) => void;
  listening: boolean;
  onOrbClick: () => void;
  voiceText: string;
  onOpenChat: () => void;
}) {
  const { overview: ov } = data;
  return (
    <>
      <div
        style={{
          position: "relative",
          background: "linear-gradient(160deg,rgba(255,255,255,.55),rgba(233,227,251,.5))",
          border: "1px solid rgba(255,255,255,.75)",
          backdropFilter: "blur(18px)",
          borderRadius: 28,
          padding: "40px 14px 24px",
          marginBottom: 18,
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(109,94,240,.12)",
        }}
      >
        <HeroOrb ov={ov} size={300} orbSize={140} listening={listening} onOrbClick={onOrbClick} />
        <ModuleSegments module={module} onChange={setModule} style={{ marginTop: 16 }} />
      </div>

      <div
        onClick={onOrbClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          margin: "0 auto 14px",
          padding: "9px 16px",
          borderRadius: 100,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          maxWidth: "fit-content",
          background: listening ? C.primary : "rgba(255,255,255,.6)",
          border: `1px solid ${listening ? C.primary : "rgba(255,255,255,.8)"}`,
          color: listening ? "#fff" : C.body,
          boxShadow: listening ? "0 8px 22px rgba(109,94,240,.35)" : "0 2px 8px rgba(84,64,160,.08)",
        }}
      >
        <svg width="11" height="14" viewBox="0 0 12 14" aria-hidden>
          <rect x="4" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 7a4 4 0 008 0M6 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
        <span>{voiceText}</span>
      </div>

      <OpdTodayCard ov={ov} cardStyle={{ ...glass, marginBottom: 14 }} />
      <IpdSummaryCard ov={ov} cardStyle={{ ...glass, marginBottom: 14 }} onOpenIpd={() => setModule("ipd")} />

      <div
        style={{
          background: "linear-gradient(135deg,#2c2650,#1a1730)",
          borderRadius: 22,
          padding: 20,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 20px rgba(30,20,60,.3)",
        }}
      >
        <Orb size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>ARANKUB Assistant</div>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>ถามอะไรก็ได้เกี่ยวกับงานของทีม</div>
        </div>
        <button
          onClick={onOpenChat}
          style={{
            background: "rgba(255,255,255,.14)",
            border: "none",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            padding: "9px 14px",
            borderRadius: 100,
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          เริ่มแชท
        </button>
      </div>
    </>
  );
}
