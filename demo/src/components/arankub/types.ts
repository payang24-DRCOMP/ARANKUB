export type Kpi = { label: string; value: string; unit: string; delta: string; good: boolean };

export interface Overview {
  date: string;
  opdToday: number;
  opdYesterday: number;
  opdDelta: string;
  admittedToday: number;
  referOutToday: number;
  incomeToday: number;
  ipdCensus: number;
  ipdBeds: number;
  ipdOccupancyPct: number;
  ipdFreeBeds: number;
  ipdAdmitToday: number;
  ipdDischargeToday: number;
  ipdAvgLos: number;
  opdDone: number;
  opdPending: number;
  opdTarget: number;
  wardsTop: { name: string; occupied: number; beds: number; pct: number; configured: boolean }[];
  bedsConfigured: boolean;
  live: boolean;
}

export interface OpdData {
  kpis: Kpi[];
  depts: { name: string; count: number; pct: number; level: "high" | "medium" | "low" }[];
  hours: { hour: string; today: number; avg: number }[];
  rights: { label: string; count: number; pct: number }[];
  flagged: { name: string; count: number; severity: string }[];
  total: number;
}

export interface IpdData {
  kpis: Kpi[];
  wards: { name: string; occupied: number; beds: number; pct: number; los: number; configured: boolean }[];
  flow: { label: string; date: string; admit: number; discharge: number }[];
  diagnoses: { code: string; name: string; count: number }[];
  month: { cases: number; bedDays: number; avgLos: number; drgGrouped: number; adjRwSum: number };
}

export interface DashboardData {
  overview: Overview;
  opd: OpdData;
  ipd: IpdData;
}

export interface ReportsData {
  compare: { label: string; ym: string; now: number; prev: number }[];
  compareDeltaPct: number | null;
  revenue: { ym: string; label: string; amount: number }[];
  revenueTotal: number;
  revenueDeltaPct: number | null;
  rights: { label: string; count: number; pct: number }[];
  rightsTotal: number;
  diseases: { rank: number; code: string; name: string; count: number; prev: number; trendPct: number | null }[];
  diseaseTotal: number;
  deptCompare: { opd: { label: string; count: number }[]; ipd: { label: string; count: number }[] };
  recent: { title: string; time: string; status: string; kind: string }[];
}

export interface FinanceData {
  period: { from: string; to: string; label: string };
  kpis: Kpi[];
  funds: { label: string; income: number; visits: number; pct: number }[];
  fundTotal: number;
  rep: {
    claimed: number;
    approved: number;
    loss: number;
    passRate: number;
    /** ยอดจากการนำเข้าไฟล์ REP: จำนวนไฟล์ · งวด · รายการ · ผ่าน/ไม่ผ่าน + งวดล่าสุด */
    files: number;
    periodCount: number;
    records: number;
    pass: number;
    fail: number;
    lastPeriod: string;
    lastImport: string | null;
    periods: { label: string; claimed: number; approved: number; loss: number }[];
  } | null;
  ccodes: { code: string; description: string; count: number; loss: number }[];
  subFunds: { label: string; cases: number; approved: number }[];
  seamless: { label: string; claimed: number; compensated: number; pending: number; cases: number }[];
  rider: { cases: number; sent: number; claimAmount: number; missed: number; fy: number } | null;
  trend: { month: string; label: string; income: number | null; visits: number }[];
  /** กองทุนย่อยทั้งหมดที่มีเงินเข้าในปีงบนี้ เรียงตามยอด — ใช้สร้างเมนูหน้ารายละเอียดรายกองทุน */
  fundMenu: { tag: string; label: string; cases: number; claimed: number; approved: number }[];
  fy: number;
}

/** รายงานสรุปการติด C (สปสช. ตัด/ปฏิเสธการจ่าย) — /api/arankub/ccode */
export interface CcodeData {
  period: { from: string; to: string; label: string; fy: number };
  totals: { records: number; failed: number; claimed: number; approved: number; loss: number; passRate: number };
  codes: { code: string; description: string; fix: string; count: number; claimed: number; loss: number; pct: number }[];
  months: { ym: string; label: string; failed: number; loss: number }[];
  funds: { tag: string; label: string; count: number; loss: number }[];
  messages: { code: string; message: string; count: number }[];
}

export interface PatientSummary {
  hn: string;
  name: string;
  age: number | null;
  sex: string;
  right: string;
  chronic: string;
  lastVisit: string;
  lastVisitLabel: string;
}

export interface PatientDetail extends PatientSummary {
  vitals: { label: string; value: string; unit: string; status: string; bad: boolean }[];
  diagnoses: string[];
  visits: { detail: string; date: string }[];
  labAbnormal: string[];
  drugs: string[];
  aiSummary: string | null;
}

/** Seamless for DMIS — /api/arankub/seamless */
export interface SeamlessData {
  summary: {
    batches: number;
    rows: number;
    patients: number;
    claimed: number;
    compensated: number;
    notCompensated: number;
    payMore: number;
    recall: number;
    countComp: number;
    countNotComp: number;
    rate: number;
  } | null;
  repTypes: { code: string; label: string; patients: number; cases: number; claimed: number; compensated: number; pending: number }[];
  items: { code: string; label: string; patients: number; cases: number; claimed: number; compensated: number; pending: number }[];
  rights: { code: string; label: string; patients: number; cases: number; claimed: number; compensated: number; pending: number }[];
  denyCodes: { code: string; description: string; cases: number; patients: number; amount: number }[];
  imports: { repNo: string; repType: string; label: string; rows: number; claimed: number; compensated: number; reportDate: string; importDate: string | null }[];
}
