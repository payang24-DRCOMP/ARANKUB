"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IOSFrame } from "./IOSFrame";
import { useVoice } from "./useVoice";
import { C, POPPINS, clock24, fmt, glass, glassWeb, greeting, initials, navPill, thaiDate, thaiDateShort } from "./theme";
import { BarRow, Empty, Legend, Orb, OverlayBars, SectionTitle } from "./parts";
import { HeroOrb, IpdScreen, IpdSummaryCard, ModuleSegments, OpdScreen, OpdTodayCard, OverviewMobile } from "./screens-dashboard";
import { ChatComposer, ChatScreen, PatientsScreen, ReportsScreen, type ChatMsg } from "./screens-more";
import { FinanceScreen, FundsDirectory } from "./screens-finance";
import { FundDetailScreen } from "./screens-services";
import { CcodeScreen } from "./screens-ccode";
import { SeamlessScreen } from "./screens-seamless";
import type { DashboardData, FinanceData, ReportsData } from "./types";

type Tab = "dashboard" | "reports" | "finance" | "patients" | "chat";
type Module = "all" | "opd" | "ipd";

/** กองทุนย่อยที่มี icode ยืนยันแล้ว — ใช้ทั้งหน้ากราฟและบริบทของผู้ช่วย AI */
const SERVICE_FUNDS = [
  { key: "TELEMED", label: "Telemedicine" },
  { key: "DRUG_DELIVERY", label: "ส่งยาที่บ้าน" },
] as const;

interface ServiceTotals {
  label: string;
  totals: { hosxpPrimary: number; repCases: number; repAmount: number; gap: number };
}

const SUGGESTIONS = [
  "สรุปยอดผู้ป่วยนอกวันนี้",
  "ทำตารางเปรียบเทียบครองเตียงแต่ละวอร์ด",
  "วาดกราฟโรคที่พบมากที่สุดเดือนนี้",
  "แนวโน้มรายรับเทียบปีก่อน",
];

/** ผู้ช่วยตอบเป็น markdown ได้ — ตาราง GFM และโค้ดบล็อก ```chart จะถูก render เป็นของจริง */
const SYSTEM_PROMPT = [
  "คุณคือ ARANKUB Assistant ผู้ช่วยวิเคราะห์ข้อมูลของโรงพยาบาลอรัญประเทศ",
  "ตอบเป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาจีนเด็ดขาด ตอบกระชับ ตรงประเด็น",
  "อ้างอิงเฉพาะตัวเลขจากข้อมูลที่ให้มา ถ้าไม่มีข้อมูลให้บอกตรง ๆ ว่าไม่มีในระบบ ห้ามเดาตัวเลขเอง",
  "",
  "เมื่อข้อมูลเป็นชุดหลายรายการ ให้แสดงเป็นตาราง markdown เสมอ",
  "",
  "เมื่อผู้ใช้ขอกราฟ/ชาร์ต หรือข้อมูลเหมาะกับการเห็นภาพ ให้ใส่โค้ดบล็อกภาษา chart เป็น JSON ตามรูปแบบนี้",
  "```chart",
  '{"type":"bar","title":"ชื่อกราฟ","xKey":"name","series":[{"key":"value","label":"จำนวน"}],',
  ' "data":[{"name":"อายุรกรรม","value":36},{"name":"ศัลยกรรม","value":34}]}',
  "```",
  'type ใช้ได้ 3 แบบ: "bar" (เปรียบเทียบหมวด), "line" (แนวโน้มตามเวลา), "pie" (สัดส่วนของทั้งหมด)',
  "ค่าใน data ต้องเป็นตัวเลขจริงจากข้อมูลที่ให้มาเท่านั้น และเขียนคำอธิบายสั้น ๆ ประกอบกราฟด้วยเสมอ",
].join("\n");

/* ======================================================================== */

export function ArankubApp({ userName, userRole, model, isAdmin }: { userName: string; userRole: string; model: string; isAdmin: boolean }) {
  const [view, setView] = useState<"mobile" | "web">("web");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [module, setModule] = useState<Module>("all");
  const [now, setNow] = useState<Date | null>(null);

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  // หน้าย่อยของแท็บการเงิน: "overview" | "ccode" | "fund:<รหัสกองทุน>"
  const [financeView, setFinanceView] = useState<string>("overview");
  const [financeAuto, setFinanceAuto] = useState(false);
  const [services, setServices] = useState<ServiceTotals[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "สวัสดีค่ะ! ฉันคือ ARANKUB Assistant ถามเรื่องยอดผู้ป่วย เตียง หรือรายงานของโรงพยาบาลได้เลยค่ะ" },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  /* นาฬิกา — ตั้งค่าใน effect เพื่อไม่ให้ SSR/CSR ต่างกัน */
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [onPhone, setOnPhone] = useState(false);
  const [vw, setVw] = useState(1440);
  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      setVw(w);
      const phone = w < 520;
      setOnPhone(phone);
      // สลับเป็นแบบมือถือเฉพาะเครื่องมือถือจริงเท่านั้น —
      // จอเดสก์ท็อปที่ตั้งแนวตั้ง (เช่น 1080×1920) ยังใช้ layout เว็บที่ยุบคอลัมน์เอง
      setView(phone ? "mobile" : "web");
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  /* ขนาดวง AI ของหน้าเว็บ — ต้องย่อตามความกว้างที่เหลือ ไม่งั้นล้นไปทับการ์ดข้าง ๆ บนจอตั้ง */
  const heroSize = Math.max(280, Math.min(430, vw >= 1400 ? 430 : vw - 120));
  const heroOrbSize = Math.round(heroSize * 0.465);

  /* ------------------------------------------------- โหมดเต็มจอ (ขึ้นทีวี) */

  const [tvMode, setTvMode] = useState(false);
  const [autoCycle, setAutoCycle] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const enterTv = useCallback(async () => {
    setView("web");
    setTab("dashboard");
    setTvMode(true);
    try {
      await rootRef.current?.requestFullscreen?.();
    } catch {
      // เบราว์เซอร์ไม่ให้ fullscreen (เช่นไม่ได้มาจากการคลิก) — ยังใช้โหมดทีวีแบบไม่เต็มจอได้
    }
  }, []);

  const exitTv = useCallback(async () => {
    setTvMode(false);
    setAutoCycle(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ออกจาก fullscreen ไม่ได้ */
    }
  }, []);

  // กด Esc ออกจาก fullscreen เอง — ต้อง sync state ตาม
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setTvMode(false);
        setAutoCycle(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // สลับ ภาพรวม → OPD → IPD ทุก 20 วินาที สำหรับจอที่เปิดค้างไว้
  useEffect(() => {
    if (!tvMode || !autoCycle) return;
    const order: Module[] = ["all", "opd", "ipd"];
    const t = setInterval(() => setModule((m) => order[(order.indexOf(m) + 1) % order.length]), 20_000);
    return () => clearInterval(t);
  }, [tvMode, autoCycle]);

  /* โหลดข้อมูล */
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/arankub/dashboard");
      if (!res.ok) throw new Error(String(res.status));
      setDash(await res.json());
      setError(null);
    } catch {
      setError("ดึงข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 120_000); // refresh ทุก 2 นาที
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (tab !== "reports" || reports) return;
    fetch("/api/arankub/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReports(d));
  }, [tab, reports]);

  useEffect(() => {
    if (tab !== "finance" || finance) return;
    fetch("/api/arankub/finance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFinance(d));
  }, [tab, finance]);

  // ยอด Telemedicine / ส่งยาที่บ้าน — ดึงไว้ให้ผู้ช่วย AI ตอบได้ด้วย ไม่ใช่แค่หน้ากราฟ
  useEffect(() => {
    if (tab !== "finance" || services.length > 0) return;
    Promise.all(
      SERVICE_FUNDS.map((f) =>
        fetch(`/api/rep-funds/trend?fund=${f.key}&months=12`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { totals?: ServiceTotals["totals"] } | null): ServiceTotals | null => (d?.totals ? { label: f.label, totals: d.totals } : null))
      )
    ).then((rows) => setServices(rows.filter((r): r is ServiceTotals => r !== null)));
  }, [tab, services.length]);

  /* ------------------------------------------- หน้าย่อยของแท็บการเงิน */

  /** แท็บการเงินมี 3 หน้าเท่านั้น — รายละเอียดรายกองทุนเปิดจากทำเนียบกองทุนย่อย */
  const financePages = useMemo(
    () => [
      { key: "overview", label: "ภาพรวม" },
      { key: "funds", label: "REP" },
      { key: "seamless", label: "Seamless for DMIS" },
      { key: "ccode", label: "สรุปการติด C" },
    ],
    []
  );

  /** ลำดับการสลับอัตโนมัติ — 3 หน้าหลัก แล้วแวะกองทุนที่ดูบ่อย (Telemedicine · ส่งยา · ไต) */
  const financeCycle = useMemo(() => {
    const pinned = ["TELEMED", "DRUG_DELIVERY", "INST-HD-ODS"].filter((t) => (finance?.fundMenu ?? []).some((f) => f.tag === t));
    return [...financePages.map((p) => p.key), ...pinned.map((t) => `fund:${t}`)];
  }, [finance, financePages]);

  const financeFund = financeView.startsWith("fund:")
    ? (finance?.fundMenu ?? []).find((f) => f.tag === financeView.slice(5)) ?? null
    : null;

  /** คำถามยอดนิยมของแท็บการเงิน — เปลี่ยนตามหน้าย่อยที่เปิดอยู่ */
  const financeAsk = useMemo(() => {
    if (financeView === "funds")
      return { placeholder: "ถามเรื่องกองทุนย่อยใน REP…", qs: ["กองทุนย่อยไหนได้เงินมากสุด", "กองทุนไหนยังไม่ได้เงิน", "สรุปยอดที่นำเข้าจาก REP"] };
    if (financeView === "seamless")
      return { placeholder: "ถามเรื่อง Seamless for DMIS…", qs: ["สรุปกองทุนไตให้หน่อย", "รายการที่ยังไม่ได้ชดเชยมีอะไรบ้าง", "กองทุนโรคไหนได้เงินมากสุด"] };
    if (financeView === "ccode")
      return { placeholder: "ถามเรื่องการติด C…", qs: ["สรุปสาเหตุการติด C", "ควรแก้รหัสไหนก่อน", "เดือนไหนถูกตัดมากสุด"] };
    if (financeView.startsWith("fund:")) {
      const name = financeFund?.label || financeView.slice(5);
      return { placeholder: `ถามเรื่องกองทุน ${name}…`, qs: [`สรุปกองทุน ${name}`, "ทำไมยังไม่ได้เงิน", "แนวโน้ม 12 เดือนเป็นอย่างไร"] };
    }
    return { placeholder: "ถามเรื่องรายรับ กองทุน หรือการเบิกจ่าย…", qs: ["สรุปรายได้เดือนนี้", "กองทุนไหนรายได้มากสุด", "แนวโน้มรายรับ 12 เดือน"] };
  }, [financeView, financeFund]);

  // สลับหน้าย่อยอัตโนมัติทุก 20 วินาที สำหรับจอที่เปิดค้างไว้ (ใช้ได้ทั้งในและนอกโหมดทีวี)
  useEffect(() => {
    if (!financeAuto || tab !== "finance" || financeCycle.length < 2) return;
    const t = setInterval(() => {
      setFinanceView((v) => financeCycle[(financeCycle.indexOf(v) + 1) % financeCycle.length]);
    }, 20_000);
    return () => clearInterval(t);
  }, [financeAuto, tab, financeCycle]);

  /* ---------------------------------------------------------------- chat */

  /** บริบทข้อมูลจริงที่ส่งให้โมเดลทุกครั้ง เพื่อให้ตอบด้วยตัวเลขของโรงพยาบาลจริง */
  const dataContext = useMemo(() => {
    if (!dash) return "";
    const { overview: o, opd, ipd } = dash;
    return [
      `ข้อมูลโรงพยาบาลอรัญประเทศ ณ วันที่ ${o.date}:`,
      `- ผู้ป่วยนอกวันนี้ ${o.opdToday} ครั้ง (เมื่อวาน ${o.opdYesterday}), ตรวจเสร็จ ${o.opdDone}, ยังอยู่ในระบบ ${o.opdPending}, รับไว้รักษา ${o.admittedToday}, ส่งต่อ ${o.referOutToday}`,
      `- ค่ารักษาผู้ป่วยนอกวันนี้ ${o.incomeToday} บาท`,
      `- ผู้ป่วยในคงรักษา ${o.ipdCensus} ราย จากเตียง ${o.ipdBeds} เตียง (ครองเตียง ${o.ipdOccupancyPct}%), รับใหม่ ${o.ipdAdmitToday}, จำหน่าย ${o.ipdDischargeToday}, LOS เฉลี่ย 30 วัน ${o.ipdAvgLos} วัน`,
      `- แผนกที่มีผู้ป่วยนอกมากสุดวันนี้: ${opd.depts.slice(0, 5).map((d) => `${d.name} ${d.count} ครั้ง`).join(", ")}`,
      `- สิทธิการรักษาวันนี้: ${opd.rights.map((r) => `${r.label} ${r.count} ราย (${r.pct}%)`).join(", ")}`,
      `- วอร์ดที่ครองเตียงสูงสุด: ${ipd.wards.slice(0, 5).map((w) => `${w.name} ${w.occupied}/${w.beds} เตียง (${w.pct}%)`).join(", ")}`,
      `- โรคหลักที่รับไว้รักษามากใน 90 วันล่าสุด: ${ipd.diagnoses.map((d) => `${d.code} ${d.name} ${d.count} ราย`).join(", ")}`,
      `- เดือนนี้จำหน่ายผู้ป่วยใน ${ipd.month.cases} เคส วันนอนรวม ${ipd.month.bedDays} วัน (LOS เฉลี่ย ${ipd.month.avgLos} วัน), จัดกลุ่ม DRG แล้ว ${ipd.month.drgGrouped} เคส`,
      reports
        ? `- โรคที่พบมากที่สุดผู้ป่วยนอกเดือนนี้: ${reports.diseases.slice(0, 5).map((d) => `${d.code} ${d.name} ${d.count} ครั้ง`).join(", ")}`
        : "",
      reports ? `- รายรับ 12 เดือนล่าสุด ${reports.revenueTotal} บาท (เทียบปีก่อน ${reports.revenueDeltaPct ?? "-"}%)` : "",
      finance
        ? `- การเงิน: ค่ารักษาเดือนนี้แยกกองทุน ${finance.funds.map((f) => `${f.label} ${Math.round(f.income)} บาท`).join(", ")}`
        : "",
      finance?.rep
        ? `- REP สะสม: ส่งเบิก ${Math.round(finance.rep.claimed)} บาท ได้รับจริง ${Math.round(finance.rep.approved)} บาท ` +
          `ถูกปฏิเสธ ${Math.round(finance.rep.loss)} บาท (ได้รับ ${finance.rep.passRate}%)`
        : "",
      finance && finance.ccodes.length
        ? `- รหัสปฏิเสธที่เสียเงินมากสุด: ${finance.ccodes.map((c) => `${c.code} ${c.description} ${Math.round(c.loss)} บาท`).join(", ")}`
        : "",
      finance?.rider
        ? `- ส่งยาที่บ้านปีงบ ${finance.rider.fy}: ออกส่งจริง ${finance.rider.sent} เคส ยอดเบิก ${Math.round(finance.rider.claimAmount)} บาท ยังไม่ลงเบิก ${finance.rider.missed} เคส`
        : "",
      finance && finance.fundMenu.length
        ? `- กองทุนย่อยที่ได้รับเงินมากสุดปีงบ ${finance.fy}: ${finance.fundMenu
            .slice(0, 8)
            .map((f) => `${f.label ? `${f.label} (${f.tag})` : f.tag} ${f.approved} บาท จาก ${f.cases} รายการ`)
            .join(", ")}`
        : "",
      ...services.map(
        (s) =>
          `- ${s.label} 12 เดือน: ให้บริการ ${s.totals.hosxpPrimary} ครั้ง (คีย์บิลใน HosXP), ` +
          `สปสช. ยืนยันจ่าย ${s.totals.repCases} ครั้ง ${Math.round(s.totals.repAmount)} บาท, ` +
          `ยังไม่ได้เงิน ${s.totals.gap} ครั้ง`
      ),
    ]
      .filter(Boolean)
      .join("\n");
  }, [dash, reports, finance, services]);

  // ตัวช่วยพูด/ฟัง — ประกาศเป็น ref ก่อนเพราะ sendMessage กับ useVoice อ้างถึงกันไปมา
  const voiceRef = useRef<{ onReply: (reply: string, fromVoice: boolean) => void } | null>(null);

  const sendMessage = useCallback(
    async (text: string, speakReply = false) => {
      if (!text.trim() || isTyping) return;
      setTab("chat");
      const history = [...messages, { role: "user" as const, content: text }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setIsTyping(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...(dataContext
                ? [
                    { role: "user", content: dataContext },
                    { role: "assistant", content: "รับทราบค่ะ จะตอบจากข้อมูลชุดนี้เท่านั้น" },
                  ]
                : []),
              ...history.map((m) => ({ role: m.role, content: m.content })),
            ],
            model,
            stream: true,
          }),
        });
        if (!res.ok || !res.body) throw new Error("stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value, { stream: true }).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.thinking) continue;
              full += parsed.choices?.[0]?.delta?.content ?? parsed.content ?? "";
            } catch {
              full += payload;
            }
            setMessages([...history, { role: "assistant", content: full }]);
          }
        }
        voiceRef.current?.onReply(full, speakReply);
      } catch {
        setMessages([...history, { role: "assistant", content: "⚠️ เชื่อมต่อผู้ช่วย AI ไม่ได้ กรุณาลองใหม่อีกครั้ง" }]);
        voiceRef.current?.onReply("", speakReply);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, isTyping, dataContext, model]
  );

  /* --------------------------------------------------------------- voice */

  const voice = useVoice(useCallback((text: string) => void sendMessage(text, true), [sendMessage]));
  voiceRef.current = voice;

  const listening = voice.state === "listening";
  const speaking = voice.state === "speaking";

  const voiceText =
    voice.error ??
    (listening
      ? voice.transcript || "กำลังฟัง… พูดได้เลยค่ะ"
      : voice.state === "thinking"
        ? voice.transcript || "กำลังประมวลผล…"
        : speaking
          ? "กำลังพูด — แตะเพื่อหยุด"
          : voice.handsFree
            ? "โหมดสนทนาต่อเนื่อง — แตะวงกลมเพื่อเริ่ม"
            : "แตะวงกลม AI เพื่อสั่งงานด้วยเสียง");

  /* ------------------------------------------------------------- rendering */

  const moduleTitle = module === "opd" ? "งานผู้ป่วยนอก (OPD)" : "งานผู้ป่วยใน (IPD)";
  const moduleSubtitle =
    module === "opd" ? "ความแออัด การไหลของผู้ป่วย และคุณภาพการลงรหัสวันนี้" : "การครองเตียง การหมุนเวียน และน้ำหนักสัมพัทธ์ของแต่ละวอร์ด";

  const loading = !dash && !error;

  const mobileBody = (
    <>
      {error && <Empty>{error}</Empty>}
      {loading && <Empty>กำลังโหลดข้อมูลโรงพยาบาล…</Empty>}

      {tab === "dashboard" && dash && (
        <>
          {module === "all" ? (
            <>
              <MobileHeader userName={userName} now={now} />
              <div style={{ fontSize: 14, color: "#726f85", marginBottom: 6 }}>
                {now ? greeting(now) : "สวัสดี"}, {userName}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ background: "linear-gradient(135deg,#8B5CF6,#6D5EF0)", color: "#fff", fontFamily: POPPINS, fontWeight: 700, fontSize: 22, padding: "4px 14px", borderRadius: 100 }}>
                  AI
                </span>
                <span style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826" }}>ดูแลผู้ป่วย</span>
              </div>
              <div style={{ fontSize: 13.5, color: "#726f85", lineHeight: 1.5, marginBottom: 22 }}>
                ARANKUB AI สรุปงานผู้ป่วยนอก ผู้ป่วยใน และรายงานของทีมให้อัตโนมัติ
              </div>
              <OverviewMobile
                data={dash}
                module={module}
                setModule={(m) => setModule(m as Module)}
                listening={listening || speaking}
                onOrbClick={voice.toggleListening}
                voiceText={voiceText}
                onOpenChat={() => setTab("chat")}
              />
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 22, color: C.ink, marginBottom: 3 }}>{moduleTitle}</div>
                <div style={{ fontSize: 12.5, color: "#78748f" }}>{moduleSubtitle}</div>
              </div>
              <ModuleSegments module={module} onChange={(m) => setModule(m as Module)} style={{ marginBottom: 16, justifyContent: "flex-start" }} />
              {module === "opd" ? (
                <OpdScreen opd={dash.opd} ov={dash.overview} cardStyle={glass} />
              ) : (
                <IpdScreen ipd={dash.ipd} cardStyle={glass} isAdmin={isAdmin} onBedsSaved={reload} />
              )}
            </>
          )}
        </>
      )}

      {tab === "reports" && (
        <>
          <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>รายงาน</div>
          <div style={{ fontSize: 12.5, color: "#78748f", marginBottom: 16 }}>กราฟเปรียบเทียบและรายงานที่ AI สร้างให้</div>
          <AskAiBar
            placeholder="ถามเรื่องรายงานของโรงพยาบาล…"
            suggestions={["สรุปรายงานเดือนนี้ให้หน่อย", "โรคที่พบมากที่สุด 5 อันดับ", "เทียบรายรับกับปีก่อน"]}
            onAsk={(t) => sendMessage(t)}
            onMic={voice.toggleListening}
            listening={listening}
            disabled={isTyping}
          />
          <ReportsScreen data={reports} cardStyle={glass} onAsk={(p) => sendMessage(p)} />
        </>
      )}

      {tab === "finance" && (
        <>
          <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>การเงิน</div>
          <div style={{ fontSize: 12.5, color: "#78748f", marginBottom: 14 }}>ภาพรวมรายได้ · REP · Seamless · สรุปการติด C</div>
          <AskAiBar
            placeholder={financeAsk.placeholder}
            suggestions={financeAsk.qs}
            onAsk={(t) => sendMessage(t)}
            onMic={voice.toggleListening}
            listening={listening}
            disabled={isTyping}
          />
          <FinanceNav
            pages={financePages}
            value={financeView}
            onChange={setFinanceView}
            auto={financeAuto}
            onToggleAuto={() => setFinanceAuto(!financeAuto)}
          />
          {financeView === "overview" ? (
            <FinanceScreen data={finance} cardStyle={glass} onAsk={(p) => sendMessage(p)} />
          ) : financeView === "funds" ? (
            <FundsDirectory data={finance} cardStyle={glass} onOpen={(tag) => setFinanceView(`fund:${tag}`)} />
          ) : financeView === "seamless" ? (
            <SeamlessScreen cardStyle={glass} onAsk={(p) => sendMessage(p)} />
          ) : financeView === "ccode" ? (
            <CcodeScreen cardStyle={glass} onAsk={(p) => sendMessage(p)} />
          ) : (
            <>
              <BackToFunds onClick={() => setFinanceView("funds")} />
              <FundDetailScreen
                fund={financeView.slice(5)}
                label={financeFund?.label || financeView.slice(5)}
                cases={financeFund?.cases}
                approved={financeFund?.approved}
                cardStyle={glass}
                onAsk={(p) => sendMessage(p)}
              />
            </>
          )}
        </>
      )}

      {tab === "patients" && (
        <>
          <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>ผู้ป่วย</div>
          <div style={{ fontSize: 12.5, color: "#78748f", marginBottom: 14 }}>ค้นหาผู้ป่วยและดูรายงานสุขภาพ</div>
          <PatientsScreen cardStyle={glass} onAsk={(p) => sendMessage(p)} />
        </>
      )}

      {tab === "chat" && <ChatScreen messages={messages} isTyping={isTyping} onSend={(t) => sendMessage(t)} suggestions={SUGGESTIONS} voice={voice} />}
    </>
  );

  const mobileScreen = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#f4f2fb 0%,#eae5fb 55%,#e2dbf7 100%)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: onPhone ? "20px 16px 16px" : "66px 16px 16px" }}>{mobileBody}</div>
      {tab === "chat" && <ChatComposer onSend={(t) => sendMessage(t)} disabled={isTyping} voice={voice} />}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );

  // บนมือถือจริงแสดงเต็มจอ ไม่ใส่กรอบเครื่อง (กรอบ 390px จะล้นจอ) —
  // กรอบมีไว้สำหรับพรีวิวบนจอใหญ่เท่านั้น
  const mobile = onPhone ? (
    <div style={{ position: "fixed", inset: 0 }}>{mobileScreen}</div>
  ) : (
    <IOSFrame time={now ? clock24(now).slice(0, 5) : "--:--"}>{mobileScreen}</IOSFrame>
  );

  /* ------------------------------------------------------------- web view */

  /* ป้ายวันที่/เวลา — ปกติอยู่ต้นแถวหัวเรื่อง ส่วนโหมดทีวีย้ายไปมุมขวาบน */
  const clockPill = (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.7)", borderRadius: 100, whiteSpace: "nowrap" }}>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="none" stroke={C.primary} strokeWidth="1.3" />
        <path d="M7 4v3.4l2.3 1.4" stroke={C.primary} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      </svg>
      <span style={{ fontSize: 11.5, color: C.body, fontWeight: 500 }}>{now ? thaiDateShort(now) : "—"}</span>
      <span style={{ width: 1, height: 13, background: "rgba(109,94,240,.28)" }} />
      <span style={{ fontFamily: POPPINS, fontSize: 13, fontWeight: 700, color: C.ink }}>{now ? clock24(now) : "--:--:--"}</span>
      <span style={{ fontSize: 10.5, color: C.muted }}>น.</span>
    </div>
  );

  const web = (
    <div
      ref={rootRef}
      className={tvMode ? "ark-tv" : undefined}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        background: "linear-gradient(155deg,#d5cef2 0%,#e1dbf8 42%,#eeebfd 100%)",
        overflowX: "hidden",
        overflowY: tvMode ? "auto" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 820,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(255,255,255,.85),rgba(255,255,255,0))",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          left: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(139,92,246,.16),transparent)",
          pointerEvents: "none",
        }}
      />

      {/* header — บนทีวีเก็บโลโก้กับนาฬิกาไว้ ซ่อนแค่เมนูกับชื่อผู้ใช้ (แถบควบคุมทีวีมาแทนที่ช่องนั้น) */}
      <div className="ark-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px 7px 7px", background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.7)", borderRadius: 100 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${C.violet},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(109,94,240,.4)" }}>
            <div style={{ width: 12, height: 12, background: "#fff", borderRadius: 3, transform: "rotate(45deg)" }} />
          </div>
          <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 17, color: "#1a1826", letterSpacing: "-.2px" }}>ARANKUB AI</span>
        </div>

        {!tvMode && clockPill}

        <div className="ark-header-nav">
          <button style={navPill(tab === "dashboard")} onClick={() => setTab("dashboard")}>ภาพรวม</button>
          <button style={navPill(tab === "reports")} onClick={() => setTab("reports")}>รายงาน</button>
          <button style={navPill(tab === "finance")} onClick={() => setTab("finance")}>การเงิน</button>
          <button style={navPill(tab === "chat")} onClick={() => setTab("chat")}>ผู้ช่วย AI</button>
          <button style={navPill(tab === "patients")} onClick={() => setTab("patients")}>ผู้ป่วย</button>
        </div>

        {/* โหมดทีวี — ปุ่มควบคุมย่อเป็นไอคอน แล้วให้ป้ายวันที่/เวลาอยู่มุมขวาบนแทน */}
        {tvMode ? (
          <div className="ark-header-user">
            <IconButton
              on={autoCycle}
              onClick={() => setAutoCycle(!autoCycle)}
              label={autoCycle ? "สลับหน้าอัตโนมัติ: เปิด" : "สลับหน้าอัตโนมัติ: ปิด"}
            >
              <path d="M12.1 7A5.1 5.1 0 1 1 10.4 3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7.8 3.5h2.9V0.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </IconButton>
            <IconButton onClick={exitTv} label="ออกจากโหมดเต็มจอ (หรือกด Esc)">
              <path
                d="M1.5 5H5V1.5M9 1.5V5h3.5M12.5 9H9v3.5M5 12.5V9H1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </IconButton>
            {clockPill}
          </div>
        ) : (
        <div className="ark-header-user">
          <button
            onClick={enterTv}
            title="แสดงเต็มจอสำหรับขึ้นทีวี — กด Esc เพื่อออก"
            style={{ ...navPill(false), display: "flex", alignItems: "center", gap: 7 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            เต็มจอ
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 14px 5px 5px", background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.7)", borderRadius: 100 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${C.violet},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>
            {initials(userName)}
          </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1826", lineHeight: 1.2 }}>{userName}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.2 }}>{userRole}</div>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="ark-main">
        {error && <Empty>{error}</Empty>}
        {loading && <Empty>กำลังโหลดข้อมูลโรงพยาบาล…</Empty>}

        {/* คำทักทายผู้ใช้ — เป็นหัวเรื่องของหน้าชิดซ้าย คู่กับปุ่มเลือกโมดูลทางขวา
            (ไม่ใช้ป้ายเม็ดยาแล้ว เพราะไปชนกับกลุ่มเมนูเม็ดยาด้านบน) */}
        {tab === "dashboard" && dash && module === "all" && (
          <div className="ark-greet">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6b6784", marginBottom: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary }} />
                {now ? greeting(now) : "สวัสดี"}, {userName}
              </div>
              <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 27, lineHeight: 1.25, letterSpacing: "-.5px", color: C.ink, marginBottom: 6 }}>
                <span
                  style={{
                    backgroundImage: `linear-gradient(120deg,${C.violet},${C.blue})`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  AI เฉพาะด้าน
                </span>{" "}
                ดูแลผู้ป่วย
              </div>
              <div style={{ fontSize: 12.5, color: "#78748f", lineHeight: 1.5 }}>ARANKUB AI สรุปรายงานผู้ป่วยและงานของทีมให้อัตโนมัติ</div>
            </div>
            <ModuleSegments module={module} onChange={(m) => setModule(m as Module)} />
          </div>
        )}

        {tab === "dashboard" && dash && module === "all" && (
          <div className="ark-dash">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <OpdTodayCard ov={dash.overview} cardStyle={glassWeb} />
              <div style={glassWeb}>
                <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>{fmt(dash.opd.total)} ครั้งวันนี้</span>}>อัตราความแออัดจุดบริการ</SectionTitle>
                {dash.opd.depts.slice(0, 6).map((d) => (
                  <BarRow
                    key={d.name}
                    name={d.name}
                    dot={d.level === "high" ? C.bad : d.level === "medium" ? C.warn : C.good}
                    right={`${fmt(d.count)} ครั้ง`}
                    pct={d.pct}
                    gradient={d.level === "high" ? "linear-gradient(90deg,#e8748a,#d1495b)" : "linear-gradient(90deg,#8B5CF6,#6D5EF0)"}
                  />
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,.75)" }}>
                  <Legend items={[{ label: "สูง", color: C.bad }, { label: "กลาง", color: C.warn }, { label: "ปกติ", color: C.good }]} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: C.primary, cursor: "pointer" }} onClick={() => setModule("opd")}>
                    ดูหน้า OPD →
                  </span>
                </div>
              </div>
            </div>

            <div className="ark-dash-hero" style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
              <HeroOrb ov={dash.overview} size={heroSize} orbSize={heroOrbSize} listening={listening || speaking} onOrbClick={voice.toggleListening} />
              <div
                onClick={voice.toggleListening}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 8,
                  padding: "9px 16px",
                  borderRadius: 100,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  background: listening ? C.primary : "rgba(255,255,255,.6)",
                  border: `1px solid ${listening ? C.primary : "rgba(255,255,255,.8)"}`,
                  color: listening ? "#fff" : C.body,
                }}
              >
                <svg width="11" height="14" viewBox="0 0 12 14" aria-hidden>
                  <rect x="4" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 7a4 4 0 008 0M6 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                </svg>
                {voiceText}
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                <MiniToggle on={voice.voiceReply} label="ตอบด้วยเสียง" onClick={() => voice.setVoiceReply(!voice.voiceReply)} />
                <MiniToggle
                  on={voice.handsFree}
                  label="สนทนาต่อเนื่อง"
                  onClick={() => {
                    const next = !voice.handsFree;
                    voice.setHandsFree(next);
                    if (next) voice.setVoiceReply(true);
                  }}
                />
              </div>

            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <IpdSummaryCard ov={dash.overview} cardStyle={glassWeb} onOpenIpd={() => setModule("ipd")} />
              <div style={{ ...glassWeb, background: "linear-gradient(135deg,#2c2650,#1a1730)", border: "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                  <Orb size={110} listening={listening} onClick={voice.toggleListening} />
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
                    สวัสดี{userName}!
                    <div style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,.6)", marginTop: 4 }}>ให้ช่วยสรุปรายงานอะไรดีคะวันนี้?</div>
                  </div>
                  <button
                    onClick={() => setTab("chat")}
                    style={{ background: "rgba(255,255,255,.14)", border: "none", color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "10px 20px", borderRadius: 100, cursor: "pointer" }}
                  >
                    ถาม ARANKUB
                  </button>
                </div>
              </div>
              <div style={glassWeb}>
                <SectionTitle right={<span style={{ fontSize: 10.5, color: C.muted }}>เทียบเฉลี่ย 30 วัน</span>}>ผู้ป่วยรายชั่วโมง</SectionTitle>
                <OverlayBars
                  data={dash.opd.hours.map((h) => ({ label: `${h.hour}:00`, front: h.today, back: h.avg }))}
                  height={120}
                  labelEvery={3}
                  seriesLabels={["วันนี้", "เฉลี่ย 30 วัน"]}
                />
              </div>
            </div>
          </div>
        )}

        {tab === "dashboard" && dash && module !== "all" && (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: C.ink, marginBottom: 3 }}>{moduleTitle}</div>
                <div style={{ fontSize: 12.5, color: "#78748f" }}>{moduleSubtitle}</div>
              </div>
              <ModuleSegments module={module} onChange={(m) => setModule(m as Module)} />
            </div>
            <div style={{ columnCount: 2, columnGap: 20 }} className="ark-cols">
              {module === "opd" ? <OpdScreen opd={dash.opd} ov={dash.overview} cardStyle={glassWeb} /> : <IpdScreen ipd={dash.ipd} cardStyle={glassWeb} isAdmin={isAdmin} onBedsSaved={reload} />}
            </div>
          </>
        )}

        {tab === "reports" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>รายงานโรงพยาบาล</div>
              <div style={{ fontSize: 12.5, color: "#78748f", marginBottom: 14 }}>กราฟเปรียบเทียบและรายงานที่ AI สร้างให้อัตโนมัติ</div>
              <AskAiBar
                placeholder="ถามเรื่องรายงานของโรงพยาบาล…"
                suggestions={["สรุปรายงานเดือนนี้ให้หน่อย", "โรคที่พบมากที่สุด 5 อันดับ", "เทียบรายรับกับปีก่อน"]}
                onAsk={(t) => sendMessage(t)}
                onMic={voice.toggleListening}
                listening={listening}
                disabled={isTyping}
              />
            </div>
            <div style={{ columnCount: 2, columnGap: 20 }} className="ark-cols">
              <ReportsScreen data={reports} cardStyle={glassWeb} onAsk={(p) => sendMessage(p)} />
            </div>
          </>
        )}

        {tab === "finance" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>การเงินและการเบิกจ่าย</div>
              <div style={{ fontSize: 12.5, color: "#78748f", marginBottom: 14 }}>
                ภาพรวมรายได้ · REP กองทุนย่อย · Seamless for DMIS · สรุปการติด C — เลือกดูทีละหน้า หรือเปิดสลับอัตโนมัติทุก 20 วินาที
              </div>
              <AskAiBar
                placeholder={financeAsk.placeholder}
                suggestions={financeAsk.qs}
                onAsk={(t) => sendMessage(t)}
                onMic={voice.toggleListening}
                listening={listening}
                disabled={isTyping}
              />
              <FinanceNav
            pages={financePages}
            value={financeView}
            onChange={setFinanceView}
            auto={financeAuto}
            onToggleAuto={() => setFinanceAuto(!financeAuto)}
          />
            </div>
            <div style={{ columnCount: 2, columnGap: 20 }} className="ark-cols">
              {financeView === "overview" ? (
            <FinanceScreen data={finance} cardStyle={glassWeb} onAsk={(p) => sendMessage(p)} />
          ) : financeView === "funds" ? (
            <FundsDirectory data={finance} cardStyle={glassWeb} onOpen={(tag) => setFinanceView(`fund:${tag}`)} />
          ) : financeView === "seamless" ? (
            <SeamlessScreen cardStyle={glassWeb} onAsk={(p) => sendMessage(p)} />
          ) : financeView === "ccode" ? (
            <CcodeScreen cardStyle={glassWeb} onAsk={(p) => sendMessage(p)} />
          ) : (
            <>
              <BackToFunds onClick={() => setFinanceView("funds")} />
              <FundDetailScreen
                fund={financeView.slice(5)}
                label={financeFund?.label || financeView.slice(5)}
                cases={financeFund?.cases}
                approved={financeFund?.approved}
                cardStyle={glassWeb}
                onAsk={(p) => sendMessage(p)}
              />
            </>
          )}
            </div>
          </>
        )}

        {tab === "patients" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 24, color: "#1a1826", marginBottom: 3 }}>ทะเบียนผู้ป่วย</div>
              <div style={{ fontSize: 12.5, color: "#78748f" }}>ค้นหาผู้ป่วย ดูรายงานสุขภาพ และประวัติการรับบริการ</div>
            </div>
            <PatientsScreen cardStyle={glassWeb} onAsk={(p) => sendMessage(p)} wide />
          </>
        )}

        {tab === "chat" && (
          <div style={{ maxWidth: 860, margin: "0 auto", ...glassWeb, padding: 24, display: "flex", flexDirection: "column", minHeight: 520 }}>
            <ChatScreen messages={messages} isTyping={isTyping} onSend={(t) => sendMessage(t)} suggestions={SUGGESTIONS} voice={voice} />
            <div style={{ marginTop: 16, marginInline: -24, marginBottom: -24, borderRadius: "0 0 26px 26px", overflow: "hidden" }}>
              <ChatComposer onSend={(t) => sendMessage(t)} disabled={isTyping} voice={voice} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // บนมือถือจริงไม่ต้องมีปุ่มสลับ — แสดงแอปเต็มจอไปเลย
  if (view === "mobile" && onPhone) return mobile;

  return (
    <div style={{ minHeight: "100vh", background: view === "mobile" ? "linear-gradient(160deg,#c9c2ea,#ded8f4 55%,#e9e5fa)" : "transparent" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: view === "mobile" ? "24px 20px 0" : "0" }}>
        {view === "mobile" && (
          <>
            <button onClick={() => setView("mobile")} style={toggleBtn(true)}>มือถือ</button>
            <button onClick={() => setView("web")} style={toggleBtn(false)}>เว็บ</button>
          </>
        )}
      </div>

      {view === "mobile" ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 12px 40px" }}>{mobile}</div>
      ) : (
        <>
          {web}
          <button
            onClick={() => setView("mobile")}
            style={{ position: "fixed", right: 20, bottom: 20, ...toggleBtn(false), zIndex: 50 }}
            title="ดูแบบมือถือ"
          >
            มือถือ
          </button>
        </>
      )}
    </div>
  );
}

/**
 * แถบถาม AI ด้านบนหน้ารายงาน/การเงิน — พิมพ์ถามได้ทันที
 * พร้อมคำถามยอดนิยมของหน้านั้น ๆ และปุ่มไมค์ (ใช้ระบบเสียงตัวเดียวกับหน้าแรก)
 */
function AskAiBar({
  placeholder,
  suggestions,
  onAsk,
  onMic,
  listening,
  disabled,
}: {
  placeholder: string;
  suggestions: string[];
  onAsk: (text: string) => void;
  onMic: () => void;
  listening: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    onAsk(t);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 8px 8px 10px",
          borderRadius: 100,
          background: "linear-gradient(120deg,rgba(255,255,255,.82),rgba(255,255,255,.55))",
          border: "1px solid rgba(255,255,255,.85)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 10px 30px rgba(84,64,160,.10)",
        }}
      >
        <div
          className="ark-breathe"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg,${C.violet},${C.blue})`,
            boxShadow: "0 6px 16px rgba(109,94,240,.4)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 1.6l1.5 3.9L13.4 7l-3.9 1.5L8 12.4 6.5 8.5 2.6 7l3.9-1.5z" fill="#fff" />
          </svg>
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          aria-label="ถามผู้ช่วย AI"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: C.ink,
            fontFamily: "inherit",
          }}
        />

        <button
          onClick={onMic}
          title="สั่งงานด้วยเสียง"
          aria-label="สั่งงานด้วยเสียง"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: "50%",
            cursor: "pointer",
            background: listening ? C.primary : "rgba(255,255,255,.7)",
            border: `1px solid ${listening ? C.primary : "rgba(109,94,240,.18)"}`,
            color: listening ? "#fff" : C.body,
          }}
        >
          <svg width="13" height="15" viewBox="0 0 12 14" aria-hidden>
            <rect x="4" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 7a4 4 0 008 0M6 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        <button
          onClick={submit}
          disabled={disabled}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            borderRadius: 100,
            border: "none",
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.55 : 1,
            color: "#fff",
            background: `linear-gradient(135deg,${C.violet},${C.blue})`,
            boxShadow: "0 6px 18px rgba(109,94,240,.35)",
          }}
        >
          ถาม AI
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 7h9M7.5 3.2L11.3 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => !disabled && onAsk(q)}
            style={{
              padding: "6px 13px",
              borderRadius: 100,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              background: "rgba(255,255,255,.6)",
              border: "1px solid rgba(109,94,240,.16)",
              color: C.body,
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** ปุ่มย้อนกลับจากหน้ารายละเอียดกองทุนไปยังทำเนียบกองทุนย่อย */
function BackToFunds({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 12,
        padding: "7px 14px",
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        background: "rgba(255,255,255,.7)",
        border: "1px solid rgba(109,94,240,.18)",
        color: C.body,
      }}
    >
      ← กลับไปรายการกองทุนย่อย
    </button>
  );
}

function FinanceNav({
  pages,
  value,
  onChange,
  auto,
  onToggleAuto,
}: {
  pages: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  auto: boolean;
  onToggleAuto: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {pages.map((i) => {
        // อยู่ในหน้ารายละเอียดกองทุน = ยังนับว่าอยู่หมวด "กองทุนย่อย"
        const on = i.key === value || (i.key === "funds" && value.startsWith("fund:"));
        return (
          <button
            key={i.key}
            onClick={() => onChange(i.key)}
            style={{
              padding: "9px 16px",
              borderRadius: 100,
              fontSize: 12.5,
              fontWeight: on ? 700 : 600,
              cursor: "pointer",
              background: on ? "#1a1826" : "rgba(255,255,255,.7)",
              border: `1px solid ${on ? "#1a1826" : "rgba(109,94,240,.18)"}`,
              color: on ? "#fff" : C.body,
            }}
          >
            {i.label}
          </button>
        );
      })}

      <MiniToggle on={auto} label={auto ? "สลับหน้าอัตโนมัติ" : "สลับหน้าอัตโนมัติ (ปิด)"} onClick={onToggleAuto} />
    </div>
  );
}

function IconButton({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        cursor: "pointer",
        background: on ? C.primary : "rgba(255,255,255,.55)",
        backdropFilter: "blur(14px)",
        border: `1px solid ${on ? C.primary : "rgba(255,255,255,.7)"}`,
        color: on ? "#fff" : C.body,
        boxShadow: on ? "0 6px 16px rgba(109,94,240,.35)" : "none",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function MiniToggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: on ? C.primary : "rgba(255,255,255,.6)",
        border: `1px solid ${on ? C.primary : "rgba(255,255,255,.85)"}`,
        color: on ? "#fff" : C.body,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#fff" : "rgba(109,94,240,.35)" }} />
      {label}
    </button>
  );
}

const toggleBtn = (active: boolean) => ({
  border: "none",
  borderRadius: 100,
  padding: "10px 24px",
  fontSize: 13,
  fontWeight: 600,
  background: active ? "#1a1826" : "rgba(255,255,255,.85)",
  color: active ? "#fff" : "#4a4658",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,.12)",
});

/* ------------------------------------------------------------ mobile bits */

function MobileHeader({ userName, now }: { userName: string; now: Date | null }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg,${C.violet},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(109,94,240,.35)" }}>
            <div style={{ width: 12, height: 12, background: "#fff", borderRadius: 3, transform: "rotate(45deg)" }} />
          </div>
          <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 16, color: "#1a1826", letterSpacing: "-.2px" }}>ARANKUB</span>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${C.violet},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
          {initials(userName)}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 14px", background: "rgba(255,255,255,.6)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 100, maxWidth: "fit-content" }}>
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="6" fill="none" stroke={C.primary} strokeWidth="1.3" />
          <path d="M7 4v3.4l2.3 1.4" stroke={C.primary} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
        <span style={{ fontSize: 11.5, color: C.body, fontWeight: 500 }}>{now ? thaiDate(now) : "—"}</span>
        <span style={{ width: 1, height: 12, background: "rgba(109,94,240,.28)" }} />
        <span style={{ fontFamily: POPPINS, fontSize: 13, fontWeight: 700, color: C.ink }}>{now ? clock24(now) : "--:--:--"}</span>
        <span style={{ fontSize: 10, color: C.muted }}>น.</span>
      </div>
    </>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const active = C.primary;
  const inactive = "#b6b2cc";
  const item = (key: Tab, label: string, icon: (c: string) => React.ReactNode) => {
    const on = tab === key;
    const color = on ? active : inactive;
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", padding: "4px 10px", cursor: "pointer" }}
      >
        {icon(color)}
        <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-around", padding: "10px 8px 26px", background: "rgba(255,255,255,.85)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(0,0,0,.05)" }}>
      {item("dashboard", "หน้าหลัก", (c) => (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="1" y="1" width="8" height="8" rx="2.5" fill={c} />
          <rect x="11" y="1" width="8" height="8" rx="2.5" fill={c} opacity=".55" />
          <rect x="1" y="11" width="8" height="8" rx="2.5" fill={c} opacity=".55" />
          <rect x="11" y="11" width="8" height="8" rx="2.5" fill={c} />
        </svg>
      ))}
      {item("reports", "รายงาน", (c) => (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="1" y="11" width="4.5" height="8" rx="1.4" fill={c} />
          <rect x="7.8" y="6" width="4.5" height="13" rx="1.4" fill={c} />
          <rect x="14.5" y="1" width="4.5" height="18" rx="1.4" fill={c} />
        </svg>
      ))}
      {item("finance", "การเงิน", (c) => (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="1" y="4" width="18" height="12" rx="2.5" fill={c} opacity=".55" />
          <circle cx="10" cy="10" r="3.2" fill={c} />
        </svg>
      ))}
      {item("patients", "ผู้ป่วย", (c) => (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="6" r="3.6" fill={c} />
          <path d="M3 19c0-3.9 3.1-7 7-7s7 3.1 7 7z" fill={c} opacity=".55" />
        </svg>
      ))}
      {item("chat", "แชท", (c) => (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <path d="M2 3h16v10H9l-4 4v-4H2z" fill={c} />
        </svg>
      ))}
    </div>
  );
}
