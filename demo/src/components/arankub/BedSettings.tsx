"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { C, POPPINS, fmt } from "./theme";
import { Empty, SectionTitle } from "./parts";

interface WardBed {
  ward: string;
  name: string;
  fullName: string;
  registered: number;
  peak: number;
  openBeds: number;
  note: string | null;
}

/** ปุ่มเล็กเปิดหน้าตั้งค่า — วางไว้มุมการ์ด ไม่ให้แย่งพื้นที่รายงาน */
export function BedSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="ตั้งค่าจำนวนเตียงที่เปิดให้บริการ"
      aria-label="ตั้งค่าจำนวนเตียงที่เปิดให้บริการ"
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        border: "1px solid rgba(109,94,240,.22)",
        background: "rgba(255,255,255,.8)",
        color: C.primary,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M7 1.2v1.6M7 11.2v1.6M12.8 7h-1.6M2.8 7H1.2M11.1 2.9l-1.1 1.1M4 10l-1.1 1.1M11.1 11.1L10 10M4 4L2.9 2.9"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** กล่องซ้อนหน้าจอสำหรับตั้งค่า — ปิดด้วยปุ่มหรือคลิกพื้นหลัง */
export function BedSettingsModal({ isAdmin, onClose, onSaved }: { isAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(30,24,60,.45)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 26,
          background: "linear-gradient(160deg,#f7f5fd,#eee9fb)",
          boxShadow: "0 30px 70px rgba(40,25,90,.35)",
          padding: 4,
        }}
      >
        <BedSettings
          cardStyle={{ background: "transparent", border: "none", boxShadow: "none", borderRadius: 22, padding: 18 }}
          isAdmin={isAdmin}
          onSaved={onSaved}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

/**
 * ตั้งค่าจำนวนเตียงที่เปิดให้บริการรายวอร์ด — ตัวหารของอัตราครองเตียง
 * ค่าที่บันทึกที่นี่คือข้อมูลจริงที่โรงพยาบาลรับรอง ไม่ใช่เลขที่เดาจาก HosXP
 */
function BedSettings({
  cardStyle,
  isAdmin,
  onSaved,
  onClose,
}: {
  cardStyle: CSSProperties;
  isAdmin: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [wards, setWards] = useState<WardBed[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/arankub/beds")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { wards: WardBed[] } | null) => {
        if (!d) return;
        setWards(d.wards);
        setDraft(Object.fromEntries(d.wards.map((w) => [w.ward, String(w.openBeds || "")])));
      });
  }, []);

  if (!wards) return <Empty>กำลังโหลดทะเบียนเตียง…</Empty>;

  const draftTotal = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);
  const peakTotal = wards.reduce((s, w) => s + w.peak, 0);
  const registeredTotal = wards.reduce((s, w) => s + w.registered, 0);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const beds = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v) || 0]));
      const res = await fetch("/api/arankub/beds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setMsg(`บันทึกแล้ว — รวมเตียงที่เปิดให้บริการ ${fmt(data.totalOpenBeds)} เตียง`);
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyPeak = () => setDraft(Object.fromEntries(wards.map((w) => [w.ward, String(w.peak || "")])));

  return (
    <div style={cardStyle}>
      <SectionTitle
        right={
          <button
            onClick={onClose}
            aria-label="ปิด"
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(109,94,240,.1)", color: C.body, cursor: "pointer", fontSize: 15, lineHeight: 1 }}
          >
            ✕
          </button>
        }
      >
        เตียงที่เปิดให้บริการรายวอร์ด
      </SectionTitle>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>
        HosXP ไม่ได้บันทึกทะเบียนเตียงที่เปิดใช้จริงไว้ ({fmt(registeredTotal)} เตียงที่ขึ้นทะเบียนคือเตียงที่เคยตั้งไว้ทั้งหมด)
        — กรอกจำนวนที่เปิดจริงของแต่ละวอร์ดเพื่อให้อัตราครองเตียงตรงกับความเป็นจริง
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px 10px", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: C.faint }}>วอร์ด</span>
        <span style={{ fontSize: 10, color: C.faint, textAlign: "right", width: 54 }}>ขึ้นทะเบียน</span>
        <span style={{ fontSize: 10, color: C.faint, textAlign: "right", width: 54 }}>เคยรับสูงสุด</span>
        <span style={{ fontSize: 10, color: C.faint, textAlign: "right", width: 66 }}>เปิดจริง</span>

        {wards.map((w) => (
          <FragmentRow
            key={w.ward}
            w={w}
            value={draft[w.ward] ?? ""}
            disabled={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, [w.ward]: v.replace(/[^\d]/g, "") }))}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.8)" }}>
        <div style={{ fontSize: 12, color: C.body }}>
          รวมที่กรอก <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: C.ink }}>{fmt(draftTotal)}</span> เตียง
          <span style={{ fontSize: 10.5, color: C.faint }}> · เคยรับสูงสุดรวม {fmt(peakTotal)}</span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={applyPeak}
              style={{ padding: "8px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.primary}44`, background: "rgba(255,255,255,.8)", color: C.primary }}
            >
              ใช้ค่าที่เคยรับสูงสุด
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: "8px 18px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: saving ? "default" : "pointer", border: "none", background: C.primary, color: "#fff", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      {!isAdmin && <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8 }}>ดูได้อย่างเดียว — เฉพาะผู้ดูแลระบบที่แก้ไขได้</div>}
      {msg && <div style={{ fontSize: 11.5, color: msg.startsWith("บันทึกแล้ว") ? C.good : C.bad, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function FragmentRow({ w, value, disabled, onChange }: { w: WardBed; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <>
      <span
        title={w.fullName}
        style={{ fontSize: 12, color: C.ink2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
      >
        {w.name}
      </span>
      <span style={{ fontSize: 11, color: C.faint, textAlign: "right", width: 54 }}>{w.registered || "-"}</span>
      <span style={{ fontSize: 11, color: C.muted, textAlign: "right", width: 54 }}>{w.peak || "-"}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="—"
        style={{
          width: 66,
          textAlign: "right",
          padding: "6px 9px",
          borderRadius: 10,
          border: `1px solid ${value ? C.primary + "55" : "rgba(109,94,240,.18)"}`,
          background: disabled ? "rgba(255,255,255,.5)" : "#fff",
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 13,
          color: C.ink,
          outline: "none",
        }}
      />
    </>
  );
}
