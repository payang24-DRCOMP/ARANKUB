import type {
  Overview,
  OpdData,
  IpdData,
  ReportsData,
  FinanceData,
  Kpi,
} from "@/components/arankub/types";

/**
 * ข้อมูลจำลองสำหรับเดโม — ไม่มีข้อมูลผู้ป่วยจริงแม้แต่รายการเดียว
 *
 * ระบบจริงอ่านตัวเลขสะสมจาก PostgreSQL ที่ sync มาจาก HosXP และอ่านตัวเลข "ณ ขณะนี้"
 * (ผู้ป่วยในคงรักษา สถานะคิว OPD) จาก HosXP สดผ่านบริการ Python
 * เดโมสร้างตัวเลขขึ้นเองทั้งหมด จึงรันได้โดยไม่ต้องมีฐานข้อมูลหรือ HIS
 *
 * ตัวเลขถูกทำให้ "ขยับ" ตามเวลาจริงของวัน เพื่อให้หน้าจอดูมีชีวิตเหมือนระบบจริง
 * แต่ใช้ค่าคงที่เป็นฐาน (ไม่สุ่มใหม่ทุกครั้ง) ไม่งั้นตัวเลขจะกระโดดทุก 2 นาทีที่หน้าจอรีเฟรช
 */

/** สุ่มแบบคาดเดาได้จาก seed — ให้ผลเดิมทุกครั้งที่เรียกด้วย seed เดิม */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** สัดส่วนของวันที่ผ่านไปแล้ว (0–1) ตามเวลาไทย — ใช้ให้ตัวเลขเดินตามเวลาจริง */
function dayProgress(): number {
  const now = new Date();
  const bkkHour = (now.getUTCHours() + 7) % 24;
  const mins = bkkHour * 60 + now.getUTCMinutes();
  // งาน OPD เดินระหว่าง 07:00–16:00 นอกเวลานั้นถือว่าจบวันแล้ว
  return Math.min(1, Math.max(0, (mins - 7 * 60) / (9 * 60)));
}

function bangkokDateString(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

const WARDS = [
  { name: "อายุรกรรมหญิง", beds: 68 },
  { name: "อายุรกรรมชาย", beds: 59 },
  { name: "พิเศษอายุรกรรม", beds: 26 },
  { name: "ศัลยกรรม", beds: 44 },
  { name: "กุมารเวชกรรม", beds: 32 },
  { name: "สูติกรรม", beds: 30 },
  { name: "ออร์โธปิดิกส์", beds: 28 },
];

const DEPTS = [
  "คลินิกความดันโลหิตสูง",
  "ตรวจโรคทั่วไป",
  "เวชปฏิบัติครอบครัว",
  "ศัลยกรรมโรค",
  "ทันตกรรม",
  "กระดูกและข้อ",
  "กุมารเวชกรรม",
  "สูติ-นรีเวช",
];

const RIGHTS = [
  { label: "บัตรทอง (UC)", weight: 0.62 },
  { label: "ประกันสังคม", weight: 0.14 },
  { label: "ข้าราชการ (จ่ายตรง)", weight: 0.13 },
  { label: "ชำระเงินเอง", weight: 0.07 },
  { label: "สิทธิอื่น", weight: 0.04 },
];

const DISEASES = [
  { code: "I10", name: "ความดันโลหิตสูงชนิดไม่ทราบสาเหตุ" },
  { code: "E11.9", name: "เบาหวานชนิดที่ 2 ไม่มีภาวะแทรกซ้อน" },
  { code: "J06.9", name: "การติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน" },
  { code: "K30", name: "อาการอาหารไม่ย่อย" },
  { code: "M54.5", name: "ปวดหลังส่วนล่าง" },
  { code: "N39.0", name: "การติดเชื้อทางเดินปัสสาวะ" },
  { code: "A09", name: "ท้องเสียและกระเพาะอาหารลำไส้อักเสบ" },
  { code: "J20.9", name: "หลอดลมอักเสบเฉียบพลัน" },
  { code: "E78.5", name: "ภาวะไขมันในเลือดผิดปกติ" },
  { code: "R50.9", name: "ไข้ไม่ทราบสาเหตุ" },
];

const kpi = (label: string, value: string, unit: string, delta: string, good: boolean): Kpi => ({
  label,
  value,
  unit,
  delta,
  good,
});

const baht = (n: number) => n.toLocaleString("th-TH");

export function demoOverview(): Overview {
  const rnd = seeded(20260909);
  const progress = dayProgress();
  const opdTarget = 860;
  const opdToday = Math.round(opdTarget * (0.35 + progress * 0.62));
  const opdYesterday = 913;
  const deltaPct = ((opdToday - opdYesterday) / opdYesterday) * 100;

  const wardsTop = WARDS.map((w) => {
    const pct = 0.45 + rnd() * 0.5;
    const occupied = Math.round(w.beds * pct);
    return {
      name: w.name,
      occupied,
      beds: w.beds,
      pct: Math.round((occupied / w.beds) * 100),
      configured: true,
    };
  });

  const ipdBeds = WARDS.reduce((s, w) => s + w.beds, 0);
  const ipdCensus = wardsTop.reduce((s, w) => s + w.occupied, 0);

  return {
    date: bangkokDateString(),
    opdToday,
    opdYesterday,
    opdDelta: `${deltaPct >= 0 ? "↑" : "↓"} ${Math.abs(deltaPct).toFixed(1)}%`,
    admittedToday: Math.round(14 + progress * 8),
    referOutToday: Math.round(2 + progress * 3),
    incomeToday: Math.round(opdToday * 580),
    ipdCensus,
    ipdBeds,
    ipdOccupancyPct: Math.round((ipdCensus / ipdBeds) * 100),
    ipdFreeBeds: ipdBeds - ipdCensus,
    ipdAdmitToday: Math.round(14 + progress * 8),
    ipdDischargeToday: Math.round(9 + progress * 7),
    ipdAvgLos: 3.8,
    opdDone: Math.round(opdToday * 0.45),
    opdPending: Math.round(opdToday * 0.55),
    opdTarget,
    wardsTop,
    bedsConfigured: true,
    live: false,
  };
}

export function demoOpd(ov: Overview): OpdData {
  const rnd = seeded(77001);
  const weights = DEPTS.map(() => 0.4 + rnd());
  const sum = weights.reduce((a, b) => a + b, 0);

  const depts = DEPTS.map((name, i) => {
    const count = Math.round((weights[i] / sum) * ov.opdToday);
    const pct = Math.round((count / ov.opdToday) * 100);
    return {
      name,
      count,
      pct,
      level: (pct >= 18 ? "high" : pct >= 10 ? "medium" : "low") as "high" | "medium" | "low",
    };
  }).sort((a, b) => b.count - a.count);

  // คลินิกเปิด 08:00–16:00 — คนไข้มากช่วงเช้าแล้วลดลงหลังเที่ยง ตามรูปแบบจริงของ รพ.
  const shape = [0.06, 0.18, 0.21, 0.16, 0.08, 0.11, 0.1, 0.07, 0.03];
  const hours = shape.map((f, i) => ({
    hour: `${String(8 + i).padStart(2, "0")}:00`,
    today: Math.round(ov.opdToday * f),
    avg: Math.round(ov.opdTarget * f),
  }));

  const rights = RIGHTS.map((r) => ({
    label: r.label,
    count: Math.round(ov.opdToday * r.weight),
    pct: Math.round(r.weight * 100),
  }));

  return {
    kpis: [
      kpi("ผู้ป่วยนอกวันนี้", String(ov.opdToday), "ราย", ov.opdDelta, ov.opdToday >= ov.opdYesterday),
      kpi("รอตรวจ", String(ov.opdPending), "ราย", "คิวปัจจุบัน", true),
      kpi("รับไว้รักษา", String(ov.admittedToday), "ราย", "จาก OPD", true),
      kpi("รายรับวันนี้", baht(ov.incomeToday), "บาท", "ประมาณการ", true),
    ],
    depts,
    hours,
    rights,
    flagged: [
      { name: "ลงรหัสไม่ครบ", count: 12, severity: "medium" },
      { name: "ไม่มีรหัสวินิจฉัย", count: 4, severity: "high" },
      { name: "ค่าใช้จ่ายผิดปกติ", count: 2, severity: "low" },
    ],
    total: ov.opdToday,
  };
}

export function demoIpd(ov: Overview): IpdData {
  const rnd = seeded(31337);

  const wards = ov.wardsTop.map((w) => ({
    ...w,
    los: Number((2.4 + rnd() * 3.5).toFixed(1)),
  }));

  const flow = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + 7 * 3600_000 - (6 - i) * 86400_000);
    return {
      label: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d.getUTCDay()],
      date: d.toISOString().slice(0, 10),
      admit: Math.round(12 + rnd() * 14),
      discharge: Math.round(11 + rnd() * 13),
    };
  });

  const diagnoses = DISEASES.slice(0, 6).map((d, i) => ({
    code: d.code,
    name: d.name,
    count: Math.round(48 - i * 6 + rnd() * 8),
  }));

  return {
    kpis: [
      kpi("ผู้ป่วยในคงรักษา", String(ov.ipdCensus), "ราย", `ครองเตียง ${ov.ipdOccupancyPct}%`, true),
      kpi("รับใหม่วันนี้", String(ov.ipdAdmitToday), "ราย", "", true),
      kpi("จำหน่ายวันนี้", String(ov.ipdDischargeToday), "ราย", "", true),
      kpi("LOS เฉลี่ย", String(ov.ipdAvgLos), "วัน", "30 วันล่าสุด", true),
    ],
    wards,
    flow,
    diagnoses,
    month: {
      cases: 1284,
      bedDays: 4871,
      avgLos: 3.8,
      drgGrouped: 1247,
      adjRwSum: 1583.42,
    },
  };
}

export function demoReports(): ReportsData {
  const rnd = seeded(90210);
  const months = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];

  const revenue = months.map((label, i) => ({
    ym: `2569-${String(i + 1).padStart(2, "0")}`,
    label,
    amount: Math.round(11_800_000 + rnd() * 4_200_000),
  }));
  const revenueTotal = revenue.reduce((s, r) => s + r.amount, 0);

  const diseaseTotal = 18_400;
  const diseases = DISEASES.map((d, i) => {
    const count = Math.round(2100 - i * 175 + rnd() * 120);
    const prev = Math.round(count * (0.85 + rnd() * 0.3));
    return {
      rank: i + 1,
      code: d.code,
      name: d.name,
      count,
      prev,
      trendPct: Number((((count - prev) / prev) * 100).toFixed(1)),
    };
  });

  return {
    compare: months.slice(-6).map((label, i) => ({
      label,
      ym: `2569-${String(i + 7).padStart(2, "0")}`,
      now: Math.round(20_000 + rnd() * 4_000),
      prev: Math.round(19_000 + rnd() * 4_000),
    })),
    compareDeltaPct: 4.2,
    revenue,
    revenueTotal,
    revenueDeltaPct: 6.8,
    rights: RIGHTS.map((r) => ({
      label: r.label,
      count: Math.round(diseaseTotal * r.weight),
      pct: Math.round(r.weight * 100),
    })),
    rightsTotal: diseaseTotal,
    diseases,
    diseaseTotal,
    deptCompare: {
      opd: DEPTS.slice(0, 5).map((label) => ({ label, count: Math.round(1200 + rnd() * 2400) })),
      ipd: WARDS.slice(0, 5).map((w) => ({ label: w.name, count: Math.round(180 + rnd() * 260) })),
    },
    recent: [
      { title: "ซิงก์ข้อมูลผู้ป่วยนอก", time: "10:40", status: "สำเร็จ", kind: "sync" },
      { title: "วิเคราะห์รหัสผู้ป่วยใน", time: "09:15", status: "สำเร็จ", kind: "ai" },
      { title: "ตรวจคุณภาพ 43 แฟ้ม", time: "00:05", status: "สำเร็จ", kind: "check" },
      { title: "นำเข้าผลตรวจสอบ REP", time: "เมื่อวาน", status: "สำเร็จ", kind: "import" },
    ],
  };
}

export function demoFinance(): FinanceData {
  const rnd = seeded(55512);
  const funds = [
    { label: "ผู้ป่วยนอก (OP)", income: 48_200_000, visits: 168_400 },
    { label: "ผู้ป่วยใน (IP)", income: 61_500_000, visits: 12_840 },
    { label: "ส่งเสริมป้องกัน (PP)", income: 12_900_000, visits: 42_100 },
    { label: "ค่าใช้จ่ายสูง (HC)", income: 8_400_000, visits: 1_240 },
    { label: "อุบัติเหตุฉุกเฉิน (AE)", income: 5_100_000, visits: 8_900 },
  ];
  const fundTotal = funds.reduce((s, f) => s + f.income, 0);

  return {
    period: { from: "2568-10-01", to: "2569-09-30", label: "ปีงบประมาณ 2569" },
    kpis: [
      kpi("รายรับสะสม", baht(Math.round(fundTotal / 1e6)), "ล้านบาท", "ปีงบ 2569", true),
      kpi("อัตราผ่านการตรวจสอบ", "94.2", "%", "จากยอดที่ส่งเบิก", true),
      kpi("ยอดถูกปฏิเสธ", baht(3_180_000), "บาท", "738 รายการ", false),
      kpi("รอผลตรวจสอบ", baht(6_420_000), "บาท", "1,204 รายการ", true),
    ],
    funds: funds.map((f) => ({ ...f, pct: Math.round((f.income / fundTotal) * 100) })),
    fundTotal,
    rep: {
      claimed: 142_800_000,
      approved: 134_520_000,
      loss: 8_280_000,
      passRate: 94.2,
      files: 24,
      periodCount: 12,
      records: 18_942,
      pass: 17_843,
      fail: 1_099,
      lastPeriod: "2569-08",
      lastImport: "2026-09-08",
      periods: ["มิ.ย.", "ก.ค.", "ส.ค."].map((label) => ({
        label,
        claimed: Math.round(11_000_000 + rnd() * 2_500_000),
        approved: Math.round(10_400_000 + rnd() * 2_200_000),
        loss: Math.round(400_000 + rnd() * 350_000),
      })),
    },
    ccodes: [
      { code: "C08", description: "รหัสวินิจฉัยไม่สอดคล้องกับหัตถการ", count: 214, loss: 1_840_000 },
      { code: "C24", description: "ไม่พบข้อมูลการส่งต่อ", count: 137, loss: 962_000 },
      { code: "101", description: "ข้อมูลสิทธิไม่ตรงกับฐานทะเบียน", count: 98, loss: 512_000 },
      { code: "C15", description: "วันที่ให้บริการอยู่นอกช่วงที่เบิกได้", count: 61, loss: 328_000 },
    ],
    subFunds: [
      { label: "Telemedicine", cases: 1_842, approved: 1_104_000 },
      { label: "ส่งยาที่บ้าน", cases: 1_496, approved: 448_800 },
      { label: "ผ่าตัดวันเดียว (ODS)", cases: 312, approved: 4_212_000 },
    ],
    seamless: [
      { label: "ข้ามจังหวัด (รับ)", claimed: 3_420_000, compensated: 3_140_000, pending: 280_000, cases: 842 },
      { label: "ข้ามจังหวัด (ส่ง)", claimed: 1_980_000, compensated: 1_812_000, pending: 168_000, cases: 514 },
    ],
    rider: { cases: 1_496, sent: 1_441, claimAmount: 448_800, missed: 55, fy: 2569 },
    trend: ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."].map(
      (label, i) => ({
        month: `2569-${String(i + 1).padStart(2, "0")}`,
        label,
        income: Math.round(11_800_000 + rnd() * 4_200_000),
        visits: Math.round(13_500 + rnd() * 3_200),
      })
    ),
    fundMenu: [
      { tag: "OP", label: "ผู้ป่วยนอก", cases: 168_400, claimed: 51_200_000, approved: 48_200_000 },
      { tag: "IP", label: "ผู้ป่วยใน", cases: 12_840, claimed: 64_800_000, approved: 61_500_000 },
      { tag: "PP", label: "ส่งเสริมป้องกัน", cases: 42_100, claimed: 13_400_000, approved: 12_900_000 },
      { tag: "HC", label: "ค่าใช้จ่ายสูง", cases: 1_240, claimed: 9_100_000, approved: 8_400_000 },
    ],
    fy: 2569,
  };
}

/* ------------------------------------------------------------------ IPD */

export interface DemoIpdRecord {
  an: string;
  hn: string;
  wardName: string;
  dischargeDate: string;
  los: number;
  pdx: string;
  pdxName: string;
  sex: string;
  age: number;
  drgCode: string | null;
  rw: number | null;
  adjRw: number | null;
  aiStatus: string;
}

/**
 * เคสผู้ป่วยในจำลอง — AN/HN เป็นเลขที่สร้างขึ้น ไม่ตรงกับผู้ป่วยจริงคนใด
 * ระบบจริงดึงจากตาราง an_stat / ipt / iptdiag ของ HosXP
 */
export function demoIpdRecords(count = 40): DemoIpdRecord[] {
  const rnd = seeded(424242);
  return Array.from({ length: count }, (_, i) => {
    const d = DISEASES[Math.floor(rnd() * DISEASES.length)];
    const w = WARDS[Math.floor(rnd() * WARDS.length)];
    const los = 1 + Math.floor(rnd() * 9);
    const rw = Number((0.4 + rnd() * 2.6).toFixed(4));
    return {
      an: `DEMO${String(100000 + i).padStart(6, "0")}`,
      hn: `DEMO${String(200000 + i * 7).padStart(6, "0")}`,
      wardName: w.name,
      dischargeDate: new Date(Date.now() - (i % 30) * 86400_000).toISOString().slice(0, 10),
      los,
      pdx: d.code,
      pdxName: d.name,
      sex: rnd() > 0.5 ? "หญิง" : "ชาย",
      age: 18 + Math.floor(rnd() * 70),
      drgCode: rnd() > 0.15 ? `${String(Math.floor(rnd() * 25) + 1).padStart(2, "0")}${Math.floor(rnd() * 90) + 10}` : null,
      rw: rnd() > 0.15 ? rw : null,
      adjRw: rnd() > 0.15 ? Number((rw * (0.9 + rnd() * 0.3)).toFixed(4)) : null,
      aiStatus: rnd() > 0.35 ? "analyzed" : "pending",
    };
  });
}

/** คลังความรู้จำลอง — ระบบจริงอ่านจาก Qdrant */
export function demoCollections() {
  return [
    { name: "ICD-9-2015", points_count: 1490, status: "green" },
    { name: "cpg_cmu", points_count: 2, status: "green" },
    { name: "Guideline-2017 ICD10", points_count: 463, status: "green" },
    { name: "nhso_knowledge", points_count: 4678, status: "green" },
    { name: "cpg_local", points_count: 2229, status: "green" },
    { name: "cpg_rcpt", points_count: 831, status: "green" },
    { name: "audit-2569", points_count: 1823, status: "green" },
    { name: "kpi_moph_2569", points_count: 125, status: "green" },
    { name: "tdrg633", points_count: 20116, status: "green" },
    { name: "nhso_2569", points_count: 3305, status: "green" },
    { name: "nhso69", points_count: 1112, status: "green" },
    { name: "ods_2566", points_count: 70, status: "green" },
    { name: "ICD10-WHO-2016", points_count: 5963, status: "green" },
    { name: "drug_national", points_count: 51, status: "green" },
    { name: "moph_coa_2569", points_count: 891, status: "green" },
  ];
}
