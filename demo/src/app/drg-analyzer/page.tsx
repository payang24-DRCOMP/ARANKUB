"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BrainCircuit, Search, ChevronRight, Loader2, RefreshCw,
  User, Building2, Calendar, Clock, Stethoscope, Scissors,
  CircleDot, CheckCircle2, AlertCircle, Sparkles, Database,
  Lightbulb, PlusCircle, ShieldAlert, FileSearch, ClipboardCheck,
  Download, FileCode2, FlaskConical, ScanLine, Pill, ListChecks,
  Wand2, Scale, Eye, ChevronLeft, X, ZoomIn, ZoomOut, ClipboardList, BookOpen,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { IpdAutoSyncPanel } from "@/components/dashboard/IpdAutoSyncPanel";
import { IpdAiProgress } from "@/components/dashboard/IpdAiProgress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Types ──────────────────────────────────────────────────
interface IpdRecord {
  id: string;
  an: string;
  hn: string | null;
  sex: string | null;
  ageY: string | null;
  ageM: string | null;
  admdate: string | null;
  los: string | null;
  dchdate: string;
  dchtype: string | null;
  prediag: string | null;
  wardCode: string | null;
  wardName: string | null;
  diagnosisList: string | null;
  operationList: string | null;
  drugList: string | null;
  labResults: string | null;
  xrayList: string | null;
  vitalSigns: string | null;
  underlyingDiseases: string | null;
  importedAt: string;
  aiAnalyzedAt: string | null;
  aiAnalysis: string | null;
  dxChangedAt: string | null;
  drgCode: string | null;
  rw: number | null;
  adjRw: number | null;
  drgGroupedAt: string | null;
  hosxpRw: number | null;
  hosxpDrg: string | null;
  screenFlags: ScreenFlag[] | null;
  screenSeverity: string | null;
  _count?: { aiPredictions: number };
}

/** ธงจากการตรวจรหัสแบบ rule-based (src/lib/ipd-screening.ts) */
interface ScreenFlag {
  rule: string;
  severity: "high" | "medium" | "info";
  message: string;
  detail?: string;
}

/** ธงที่เป็น "รหัสผิดกฎ" — ต่างจาก NO_DX ที่แค่ยังลงรหัสไม่เสร็จ */
const FORBIDDEN_RULES = ["PDX_FORBIDDEN", "CODE_FORBIDDEN"];

function forbiddenFlags(record: { screenFlags?: ScreenFlag[] | null } | null | undefined): ScreenFlag[] {
  return (record?.screenFlags ?? []).filter((f) => FORBIDDEN_RULES.includes(f.rule));
}

interface GrouperResult {
  an: string;
  drg_code: string;
  rw: number;
  adj_rw: number;
  wtlos: number;
  outlier_type: number | string;
  error_code: number | string;
  warn?: number | string;
  _input?: {
    pdx: string;
    age: number;
    los: number;
    sdx_count: number;
    proc_count: number;
    date_adm?: string;
    date_dsc?: string;
  };
}

interface DcEntry { dc: string; dcl: number }

interface CcMccEntry {
  code: string;
  dcl: number | null;
  dc: string | null;
  level: "MCC" | "CC" | "no-CC" | "not_found";
}

interface MdcInfo { mdc: number; name: string }

interface Suggestion {
  type: "ADD_CODE" | "CHECK_PRINCIPAL" | "CHECK_DOCUMENTATION" | "VERIFY_CODE";
  code: string | null;
  label: string;
  reason: string;
  impact: "MCC" | "CC" | "RW_UP" | "VALIDATE" | null;
}

interface AnalyzeResult {
  an: string;
  principal_dx: string;
  principal_dcs: DcEntry[];
  secondary_dcs: Record<string, DcEntry[]>;
  top_dcs: string[];
  mdc_info?: MdcInfo;
  cc_mcc_summary?: CcMccEntry[];
  suggestions?: Suggestion[];
  rag_used: { tdrg633: number; nhso69: number; icd10?: number; icd9?: number };
  aiAnalysis: string;
  version: string;
}

interface PredictedCode {
  code: string;
  description: string;
  type: "PDX" | "SDX";
  reason: string;
  evidence?: string;
  source?: string;
}

interface AiPredictionRow {
  id: string;
  an: string;
  createdAt: string;
  model: string;
  predictedCodes: PredictedCode[];
  prediag: string | null;
  currentActual: string | null;
  pdxMatch: boolean | null;
  codeCoverage: number | null;
  recall: number | null;
  dchdate: string | null;
  admdate: string | null;
  wardName: string | null;
}

// ─── Helpers ────────────────────────────────────────────────
function parsePipe(val: string | null): string[] {
  if (!val) return [];
  return val.split("|").map((s) => s.trim()).filter(Boolean);
}

// Strip diagtype prefix: "1:J441" → "J441", also strips whitespace description
function extractIcd(raw: string): string {
  return raw.replace(/^\d+:/, "").split(/\s+/)[0].toUpperCase();
}

// Normalize ICD code: remove dots so E05.9 === E059, 85.41 === 8541
function normIcd(code: string): string {
  return code.replace(/\./g, "").toUpperCase();
}

// Compute LOS: prefer integer los field, fallback to DATEDIFF(dchdate - admdate)
function computeLos(record: { los: string | null; admdate?: string | null; dchdate: string }): number {
  // Case 1: los is a valid integer (correct — from DATEDIFF in SQL)
  if (record.los && /^\d+$/.test(record.los.trim())) {
    return Math.max(0, parseInt(record.los));
  }
  // Case 2: admdate exists — compute from dates
  if (record.admdate && record.dchdate) {
    const days = Math.round(
      (new Date(record.dchdate).getTime() - new Date(record.admdate).getTime()) / 86400000
    );
    return Math.max(0, days);
  }
  // Case 3: old bug — los field contains a date string (admdate was stored as los)
  if (record.los && /^\d{4}-\d{2}-\d{2}/.test(record.los)) {
    const days = Math.round(
      (new Date(record.dchdate).getTime() - new Date(record.los).getTime()) / 86400000
    );
    return Math.max(0, days);
  }
  return 0;
}

// Age in months for infants: only used when ageY = 0
function computeAgemon(record: { ageY: string | null; ageM: string | null }): number {
  const years = record.ageY ? parseInt(record.ageY) : 0;
  if (years > 0) return 0; // adult/child — grouper uses AGE in years
  return record.ageM ? Math.max(0, parseInt(record.ageM)) : 0;
}

// HOSxP dchtype → TGrp Discht
function mapDischarge(dchtype: string | null): string {
  const map: Record<string, string> = {
    "1": "5", "2": "1", "3": "2", "4": "3", "5": "6", "6": "5", "7": "6",
  };
  if (!dchtype) return "5";
  return map[dchtype.trim()] ?? "9";
}

function icd10ToMdc(code: string): string {
  const ch = code[0]?.toUpperCase() ?? "";
  const num2 = parseInt(code.slice(1, 3)) || 0;
  if (ch === "A" || ch === "B") return "MDC18 ติดเชื้อ";
  if (ch === "C") return "MDC17 เนื้องอก";
  if (ch === "D" && num2 <= 48) return "MDC17 เนื้องอก";
  if (ch === "D") return "MDC16 โรคเลือด";
  if (ch === "E") return "MDC10 ต่อมไร้ท่อ";
  if (ch === "F") return "MDC19 จิตเวช";
  if (ch === "G") return "MDC1 ระบบประสาท";
  if (ch === "H" && num2 <= 59) return "MDC2 ตา";
  if (ch === "H") return "MDC3 หู/จมูก/คอ";
  if (ch === "I") return "MDC5 หัวใจ";
  if (ch === "J") return "MDC4 ปอด";
  if (ch === "K") return "MDC6 ทางเดินอาหาร";
  if (ch === "L") return "MDC9 ผิวหนัง";
  if (ch === "M") return "MDC8 กระดูก";
  if (ch === "N") return "MDC11 ไต/ปัสสาวะ";
  if (ch === "O") return "MDC13 ครรภ์";
  if (ch === "P") return "MDC15 ทารก";
  if (ch === "Q") return "MDC15 แต่กำเนิด";
  if (ch === "S" || ch === "T") return "MDC21 บาดเจ็บ";
  return "";
}

/** Extract ICD-10 code (first token) from "J180 Pneumonia, unspecified" */
function extractCode(s: string): string {
  return s.split(/\s+/)[0].toUpperCase();
}

const DCL_COLOR: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  2: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  3: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  4: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  5: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function DclBadge({ dcl }: { dcl: number }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", DCL_COLOR[dcl] ?? "bg-muted text-muted-foreground")}>
      L{dcl}
    </span>
  );
}

const CC_MCC_STYLE: Record<string, string> = {
  "MCC":      "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  "CC":       "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "no-CC":    "bg-muted text-muted-foreground border-border",
  "not_found":"bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-transparent",
};

function CcMccBadge({ level }: { level: string }) {
  if (level === "not_found") return null;
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold",
      CC_MCC_STYLE[level] ?? CC_MCC_STYLE["no-CC"]
    )}>
      {level}
    </span>
  );
}

// ─── Suggestion card visual config ───────────────────────────
type ImpactKey = "MCC" | "CC" | "RW_UP" | "VALIDATE";

const IMPACT_STYLE: Record<ImpactKey, { bg: string; text: string; badge: string; label: string }> = {
  MCC:      { bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-800 dark:text-red-300",      badge: "bg-red-500 text-white",            label: "↑↑ MCC"   },
  CC:       { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-800 dark:text-orange-300", badge: "bg-orange-500 text-white",          label: "↑ CC"     },
  RW_UP:    { bg: "bg-green-50 dark:bg-green-950/30",   text: "text-green-800 dark:text-green-300",   badge: "bg-green-600 text-white",           label: "↑ RW"     },
  VALIDATE: { bg: "bg-sky-50 dark:bg-sky-950/30",       text: "text-sky-800 dark:text-sky-300",       badge: "bg-sky-500 text-white",             label: "ตรวจสอบ"  },
};

const TYPE_STYLE: Record<string, { icon: React.ElementType; border: string; bg: string; tagBg: string; label: string }> = {
  ADD_CODE:            { icon: PlusCircle,    border: "border-l-4 border-l-emerald-500", bg: "bg-emerald-50/60 dark:bg-emerald-950/20",   tagBg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300", label: "เพิ่มรหัส" },
  CHECK_PRINCIPAL:     { icon: ShieldAlert,   border: "border-l-4 border-l-amber-500",   bg: "bg-amber-50/60 dark:bg-amber-950/20",       tagBg: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",       label: "รหัสหลัก"  },
  CHECK_DOCUMENTATION: { icon: FileSearch,    border: "border-l-4 border-l-blue-500",    bg: "bg-blue-50/60 dark:bg-blue-950/20",         tagBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",           label: "เอกสาร"    },
  VERIFY_CODE:         { icon: ClipboardCheck,border: "border-l-4 border-l-violet-500",  bg: "bg-violet-50/60 dark:bg-violet-950/20",     tagBg: "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300",   label: "ยืนยัน"    },
};

function SuggestionCards({
  suggestions,
  selectedCodes,
  onToggle,
}: {
  suggestions: Suggestion[];
  selectedCodes: Set<string>;
  onToggle: (code: string) => void;
}) {
  if (!suggestions.length) return null;

  // Group: high-impact first (MCC > CC > RW_UP > others)
  const impactOrder: Record<string, number> = { MCC: 0, CC: 1, RW_UP: 2, VALIDATE: 3 };
  const sorted = [...suggestions].sort((a, b) =>
    (impactOrder[a.impact ?? ""] ?? 4) - (impactOrder[b.impact ?? ""] ?? 4)
  );

  const mccCount = suggestions.filter(s => s.impact === "MCC").length;
  const ccCount  = suggestions.filter(s => s.impact === "CC").length;
  const selectableCount = suggestions.filter(s => s.type === "ADD_CODE" && s.code).length;

  return (
    <div className="space-y-2.5">
      {/* Header with summary */}
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-bold text-foreground">คำแนะนำปรับปรุง Coding</span>
        <div className="flex items-center gap-1.5 ml-auto">
          {mccCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
              {mccCount} MCC
            </span>
          )}
          {ccCount > 0 && (
            <span className="rounded-full bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5">
              {ccCount} CC
            </span>
          )}
          <span className="rounded-full bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5">
            {suggestions.length} รายการ
          </span>
        </div>
      </div>
      {selectableCount > 0 && (
        <p className="text-[11px] text-muted-foreground">
          เลือกรหัสที่ต้องการเพิ่ม แล้วกด <span className="font-semibold text-foreground">คำนวณ DRG ใหม่</span> เพื่อดูผลต่าง
        </p>
      )}

      {/* Cards */}
      <div className="grid gap-2">
        {sorted.map((s, i) => {
          const typeCfg   = TYPE_STYLE[s.type] ?? TYPE_STYLE.VERIFY_CODE;
          const impactCfg = s.impact ? IMPACT_STYLE[s.impact as ImpactKey] : null;
          const Icon      = typeCfg.icon;
          const isHighImpact = s.impact === "MCC" || s.impact === "CC";
          const isSelectable = s.type === "ADD_CODE" && !!s.code;
          const isSelected   = s.code ? selectedCodes.has(s.code) : false;

          return (
            <div
              key={i}
              onClick={() => isSelectable && s.code && onToggle(s.code)}
              className={cn(
                "rounded-xl border p-3 transition-all",
                isSelectable && "cursor-pointer select-none",
                isSelected
                  ? "ring-2 ring-blue-500 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                  : cn(
                    typeCfg.border,
                    isHighImpact
                      ? (impactCfg?.bg ?? typeCfg.bg) + " border-r border-t border-b border-border/50"
                      : typeCfg.bg + " border-r border-t border-b border-border/40",
                    isSelectable && "hover:ring-1 hover:ring-blue-400/50",
                  ),
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* Checkbox for selectable cards */}
                {isSelectable ? (
                  <div className={cn(
                    "mt-0.5 h-5 w-5 shrink-0 rounded flex items-center justify-center border-2 transition-colors",
                    isSelected
                      ? "bg-blue-500 border-blue-500"
                      : "border-muted-foreground/40 bg-background"
                  )}>
                    {isSelected && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    )}
                  </div>
                ) : (
                  <div className={cn(
                    "mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center",
                    isHighImpact
                      ? (s.impact === "MCC" ? "bg-red-500" : "bg-orange-500")
                      : "bg-foreground/8 dark:bg-foreground/10"
                  )}>
                    <Icon className={cn("h-3.5 w-3.5", isHighImpact ? "text-white" : "text-muted-foreground")} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Top row: type tag + code + impact badge */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={cn("text-[10px] font-bold rounded px-1.5 py-0.5", typeCfg.tagBg)}>
                      {typeCfg.label}
                    </span>
                    {s.code && (
                      <span className={cn(
                        "font-mono text-[12px] font-extrabold rounded px-1.5 py-0.5",
                        isSelected
                          ? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40"
                          : "text-foreground bg-foreground/10 dark:bg-foreground/15"
                      )}>
                        {s.code}
                      </span>
                    )}
                    {impactCfg && (
                      <span className={cn("rounded-full text-[10px] font-extrabold px-2 py-0.5", impactCfg.badge)}>
                        {impactCfg.label}
                      </span>
                    )}
                    {isSelected && (
                      <span className="ml-auto text-[10px] font-bold text-blue-600 dark:text-blue-400">✓ เลือกแล้ว</span>
                    )}
                  </div>

                  {/* Label - main message */}
                  <p className={cn(
                    "text-sm font-semibold leading-snug mb-0.5",
                    isHighImpact ? (impactCfg?.text ?? "text-foreground") : "text-foreground"
                  )}>
                    {s.label}
                  </p>

                  {/* Reason */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DrgCompareCard({
  original,
  modified,
  addedCodes,
  hosxpRw,
  hosxpDrg,
}: {
  original: GrouperResult;
  modified: GrouperResult;
  addedCodes: string[];
  hosxpRw?: number | null;
  hosxpDrg?: string | null;
}) {
  const rwDiff     = modified.rw - original.rw;
  const rwPct      = original.rw > 0 ? (rwDiff / original.rw) * 100 : 0;
  const drgChanged = modified.drg_code !== original.drg_code;
  const hasGain    = rwDiff > 0.001;
  const modError   = Number(modified.error_code) !== 0;

  // Compare modified vs HosXP
  const vsHosxp     = hosxpRw != null ? modified.rw - hosxpRw : null;
  const vsHosxpHigh = vsHosxp != null && vsHosxp > 0.001;
  const vsHosxpLow  = vsHosxp != null && vsHosxp < -0.001;

  const showHosxp = hosxpRw != null;
  const gridCols  = showHosxp ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <FileCode2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">เปรียบเทียบ DRG</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          เพิ่ม: {addedCodes.map(c => <span key={c} className="font-mono font-bold text-blue-600 dark:text-blue-400 mx-0.5">{c}</span>)}
        </span>
      </div>

      {/* Grid comparison */}
      <div className={cn("grid gap-2", gridCols)}>

        {/* Col 1 — HosXP an_stat (optional) */}
        {showHosxp && (
          <div className="rounded-lg border border-border/60 bg-white dark:bg-black/20 p-3 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
              HosXP<br/><span className="font-normal">(an_stat)</span>
            </p>
            <p className="font-mono text-lg font-black text-center text-foreground">{hosxpDrg || "—"}</p>
            <div className="space-y-0.5 text-center">
              <p className="text-[11px] text-muted-foreground">
                RW <span className="font-mono font-bold text-foreground text-sm">{hosxpRw!.toFixed(4)}</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60">Adj RW —</p>
            </div>
          </div>
        )}

        {/* Col 2 — ระบบปัจจุบัน (existing codes) */}
        <div className="rounded-lg border border-border/60 bg-white dark:bg-black/20 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
            ระบบปัจจุบัน<br/><span className="font-normal">(รหัสเดิม)</span>
          </p>
          <p className="font-mono text-lg font-black text-center text-foreground">{original.drg_code || "—"}</p>
          <div className="space-y-0.5 text-center">
            <p className="text-[11px] text-muted-foreground">
              RW <span className="font-mono font-bold text-foreground text-sm">{original.rw > 0 ? original.rw.toFixed(4) : "—"}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Adj RW <span className="font-mono font-bold text-foreground text-sm">{original.adj_rw > 0 ? original.adj_rw.toFixed(4) : "—"}</span>
            </p>
          </div>
        </div>

        {/* Col 3 — หลังเพิ่มรหัส AI */}
        <div className={cn(
          "rounded-lg border p-3 space-y-1.5",
          hasGain
            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : modError
              ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
              : "border-border/60 bg-white dark:bg-black/20"
        )}>
          <p className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
            หลังเพิ่มรหัส<br/><span className="font-normal">(AI แนะนำ)</span>
          </p>
          <p className={cn(
            "font-mono text-lg font-black text-center",
            drgChanged ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
          )}>
            {modified.drg_code || "—"}
            {drgChanged && <span className="block text-[9px] font-normal text-emerald-600">เปลี่ยน DRG</span>}
          </p>
          <div className="space-y-0.5 text-center">
            <p className="text-[11px] text-muted-foreground">
              RW <span className={cn("font-mono font-bold text-sm", hasGain ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                {modified.rw > 0 ? modified.rw.toFixed(4) : "—"}
              </span>
              {hasGain && <span className="block text-[10px] text-emerald-600 font-bold">▲ +{rwDiff.toFixed(4)}</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Adj RW <span className={cn("font-mono font-bold text-sm", hasGain ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                {modified.adj_rw > 0 ? modified.adj_rw.toFixed(4) : "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {hasGain ? (
        <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 p-2.5 space-y-1">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 text-center">
            ▲ RW เพิ่มขึ้นจากรหัสเดิม {rwDiff.toFixed(4)} ({rwPct > 0 ? "+" : ""}{rwPct.toFixed(1)}%)
          </p>
          {vsHosxp != null && (
            <p className={cn("text-[11px] text-center font-semibold",
              vsHosxpHigh ? "text-emerald-600 dark:text-emerald-400"
              : vsHosxpLow ? "text-red-500 dark:text-red-400"
              : "text-muted-foreground"
            )}>
              {vsHosxpHigh
                ? `▲ สูงกว่า HosXP +${vsHosxp.toFixed(4)}`
                : vsHosxpLow
                ? `▼ ต่ำกว่า HosXP ${vsHosxp.toFixed(4)}`
                : "เท่ากับ HosXP"}
            </p>
          )}
          <p className="text-[11px] text-emerald-600 dark:text-emerald-500 text-center">
            การเพิ่มรหัสที่ถูกต้องอาจช่วยให้โรงพยาบาลได้รับงบประมาณที่เหมาะสมกับความซับซ้อนของผู้ป่วยจริง
          </p>
        </div>
      ) : modError ? (
        <p className="text-[11px] text-red-600 text-center">Error {modified.error_code} — รหัสที่เพิ่มอาจไม่ถูกต้อง ตรวจสอบกับ Coder</p>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">RW ไม่เปลี่ยนแปลง — รหัสที่เพิ่มอาจซ้ำหรือไม่กระทบ DRG</p>
      )}
      <p className="text-[10px] text-muted-foreground/60 text-center italic">
        * ผลนี้เป็นการประมาณการ — ต้องผ่านการตรวจสอบจาก Certified Coder ก่อนส่งเบิก
      </p>
    </div>
  );
}

function GrouperResultCard({ result }: { result: GrouperResult }) {
  const hasError = result.error_code !== undefined && result.error_code !== "" && Number(result.error_code) !== 0;
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      hasError
        ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
        : "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
    )}>
      <div className="flex items-center gap-2">
        <FileCode2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          ผล ThaiDRG Grouper
        </span>
        {hasError && (
          <span className="ml-auto text-xs text-red-600 dark:text-red-400">
            Error: {result.error_code}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-white dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">DRG Code</p>
          <p className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {result.drg_code || "—"}
          </p>
        </div>
        <div className="rounded-md bg-white dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">RW</p>
          <p className="font-mono text-lg font-bold text-foreground">
            {result.rw > 0 ? result.rw.toFixed(4) : "—"}
          </p>
        </div>
        <div className="rounded-md bg-white dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Adj RW</p>
          <p className="font-mono text-lg font-bold text-foreground">
            {result.adj_rw > 0 ? result.adj_rw.toFixed(4) : "—"}
          </p>
        </div>
        <div className="rounded-md bg-white dark:bg-black/20 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Outlier</p>
          <p className="font-mono text-lg font-bold text-foreground">
            {Number(result.outlier_type) === 0 ? "N" : (result.outlier_type || "N")}
          </p>
        </div>
      </div>
      {result._input && (
        <div className="rounded-md bg-black/5 dark:bg-white/5 border border-dashed border-muted-foreground/30 p-2 text-[11px] font-mono text-muted-foreground space-y-0.5">
          <p className="font-sans text-[10px] font-semibold text-muted-foreground/70 mb-1">ข้อมูลที่ส่งให้ Grouper</p>
          <p>PDx: <span className="text-foreground">{result._input.pdx || "—"}</span>
            &nbsp;|&nbsp; Age: {result._input.age}&nbsp;|&nbsp; LOS: {result._input.los}
            &nbsp;|&nbsp; SDx: {result._input.sdx_count}&nbsp;|&nbsp; Proc: {result._input.proc_count}
          </p>
          {hasError && Number(result.error_code) === 2 && (
            <p className="font-sans text-[10px] text-red-500 mt-1">
              Error 2 = PDx &quot;{result._input.pdx}&quot; ไม่พบในฐานข้อมูล TGrp — ตรวจสอบรหัส ICD-10 ว่าถูกต้อง
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DBF Export helper ────────────────────────────────────────
async function exportDbf(record: IpdRecord): Promise<void> {
  const diagnoses  = parsePipe(record.diagnosisList);
  const operations = parsePipe(record.operationList);

  const dbfRecord: Record<string, string | number> = {
    ID:     record.an,
    PDX:    (diagnoses[0] ?? "").split(/\s+/)[0].toUpperCase(),
    SEX:    record.sex ?? "",
    AGE:    record.ageY ? parseInt(record.ageY) : 0,
    AGEMON: computeAgemon(record),
    LOS:    computeLos(record),
    DISCH:  mapDischarge(record.dchtype),
  };
  diagnoses.slice(1, 21).forEach((dx, i) => {
    dbfRecord[`SDX${String(i + 1).padStart(2, "0")}`] = dx.split(/\s+/)[0].toUpperCase();
  });
  operations.slice(0, 20).forEach((op, i) => {
    dbfRecord[`PROC${String(i + 1).padStart(2, "0")}`] = op.split(/\s+/)[0].toUpperCase();
  });

  const res = await fetch("/api/drg/export-dbf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: [dbfRecord] }),
  });
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `drg_AN${record.an}.dbf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function runGrouper(record: IpdRecord, overrideCodes?: PredictedCode[]): Promise<GrouperResult> {
  let principal_dx: string;
  let secondary_dx: string[];
  let operations: string[];

  if (overrideCodes && overrideCodes.length > 0) {
    // ใช้รหัสที่ AI คาดการณ์ (กรณีผู้ป่วยไม่มีรหัสจริง)
    principal_dx = overrideCodes.find(c => c.type === "PDX")?.code ?? "";
    secondary_dx = overrideCodes.filter(c => c.type === "SDX").map(c => c.code);
    operations   = parsePipe(record.operationList)
      .map((o) => o.split(/\s+/)[0].replace(/^\d+:/, "").toUpperCase()).filter(Boolean);
  } else {
    const diagnoses = parsePipe(record.diagnosisList);
    principal_dx = extractIcd(diagnoses[0] ?? "");
    secondary_dx = diagnoses.slice(1).map(extractIcd).filter(Boolean);
    operations   = parsePipe(record.operationList)
      .map((o) => o.split(/\s+/)[0].replace(/^\d+:/, "").toUpperCase()).filter(Boolean);
  }

  const body = {
    an:           record.an,
    principal_dx,
    secondary_dx,
    operations,
    sex:    record.sex ?? "",
    age:    record.ageY ? parseInt(record.ageY) : 0,
    agemon: computeAgemon(record),
    los:    computeLos(record),
    disch:  mapDischarge(record.dchtype),
  };
  const res = await fetch("/api/drg/run-grouper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Grouper failed");
  }
  return res.json();
}

// ─── Fetch helpers ───────────────────────────────────────────
async function fetchRecords(
  search: string, analyzed: string,
  dateFrom: string, dateTo: string, ward: string, page: number,
) {
  const params = new URLSearchParams({
    limit: "20", search, analyzed, dateFrom, dateTo, ward,
    page: String(page),
  });
  const res = await fetch(`/api/ipd-records?${params}`);
  if (!res.ok) throw new Error("Failed to fetch records");
  return res.json() as Promise<{ records: IpdRecord[]; total: number; page: number; limit: number }>;
}

async function fetchWards(): Promise<string[]> {
  const res = await fetch("/api/ipd-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "wards" }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.wards ?? [];
}

// Re-extract suggestions from stored full text (same logic as FastAPI _extract_suggestions)
function extractSuggestionsFromText(text: string): { cleanText: string; suggestions: Suggestion[] } {
  const matches = [...text.matchAll(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/gi)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    try {
      const sug = JSON.parse(m[1] ?? "") as Suggestion[];
      if (Array.isArray(sug) && sug.length > 0) {
        let cleanText = text.slice(0, m.index).trim()
          .replace(/\n+#{1,3}[^\n]*ACTION[^\n]*\n*$/i, "").trim();
        // Fallback: if JSON came first, use text after the JSON block
        if (!cleanText) {
          const after = text.slice((m.index ?? 0) + (m[0]?.length ?? 0)).trim();
          cleanText = after || text.trim();
        }
        return { cleanText, suggestions: sug };
      }
    } catch { /* skip */ }
  }
  // Fallback: bare JSON array at end
  const bareMatch = text.match(/\n(\[\s*\{[\s\S]*?\}\s*\])\s*$/);
  if (bareMatch) {
    try {
      const sug = JSON.parse(bareMatch[1] ?? "") as Suggestion[];
      if (Array.isArray(sug) && sug.length > 0) {
        const cleanText = text.slice(0, text.length - bareMatch[0].length).trim();
        return { cleanText, suggestions: sug };
      }
    } catch { /* skip */ }
  }
  return { cleanText: text, suggestions: [] };
}

async function analyzeRecord(
  record: IpdRecord,
  model: string,
  onToken?: (accumulated: string) => void,
): Promise<AnalyzeResult> {
  const diagnoses  = parsePipe(record.diagnosisList);
  const operations = parsePipe(record.operationList);
  const drugs      = parsePipe(record.drugList);
  const labs       = parsePipe(record.labResults);
  const xrays      = parsePipe(record.xrayList);

  const body = {
    an:           record.an,
    principal_dx: extractIcd(diagnoses[0] ?? ""),
    secondary_dx: diagnoses.slice(1).map(extractIcd).filter(Boolean),
    operations,
    drug_list:    drugs,
    lab_results:  labs,
    xray_list:    xrays,
    ward:  record.wardName ?? record.wardCode,
    los:   computeLos(record),
    model,
  };

  const res = await fetch("/api/drg/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Analysis failed");
  }
  if (!res.body) throw new Error("No response body");

  // Read NDJSON stream
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let meta: Partial<AnalyzeResult> = {};
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === "meta") {
          meta = obj;
        } else if (obj.type === "token") {
          accumulated += obj.text;
          onToken?.(accumulated);
        } else if (obj.type === "done") {
          return { ...meta, suggestions: obj.suggestions, aiAnalysis: obj.aiAnalysis } as AnalyzeResult;
        }
      } catch { /* malformed line — skip */ }
    }
  }
  throw new Error("Stream ended without done event");
}

// ─── Sub-components ──────────────────────────────────────────
function RecordListItem({
  record,
  selected,
  onClick,
  auditStatus,
}: {
  record: IpdRecord;
  selected: boolean;
  onClick: () => void;
  auditStatus?: { score: number; auditedAt: string } | null;
}) {
  const diagnoses   = parsePipe(record.diagnosisList);
  const analyzed    = !!record.aiAnalyzedAt;
  const grouped     = !!record.drgGroupedAt;
  const uncoded     = !record.diagnosisList || record.diagnosisList.trim() === "";
  const hasPredicted = (record._count?.aiPredictions ?? 0) > 0;
  const forbidden   = forbiddenFlags(record);

  const auditBadgeStyle = auditStatus
    ? auditStatus.score >= 80
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : auditStatus.score >= 60
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      : "bg-red-500/15 text-red-700 dark:text-red-400"
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/50",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-sm font-semibold text-foreground">AN {record.an}</span>
        <div className="flex items-center gap-1 shrink-0">
          {forbidden.length > 0 && (
            <span
              className="text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-400 rounded px-1.5 py-0.5"
              title={forbidden.map((f) => f.message).join("\n")}
            >
              ⛔ รหัสผิดกฎ
            </span>
          )}
          {uncoded && (
            <span className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded px-1.5 py-0.5">
              ไม่มีรหัส
            </span>
          )}
          {record.dxChangedAt && (
            <span
              className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded px-1.5 py-0.5"
              title={`รหัสโรคถูกแก้ใน HosXP หลังวิเคราะห์ (${new Date(record.dxChangedAt).toLocaleDateString("th-TH")}) — ควรวิเคราะห์ใหม่`}
            >
              ⚠ รหัสแก้ไข
            </span>
          )}
          {hasPredicted && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-400 rounded px-1.5 py-0.5" title="มีรหัสที่ AI คาดการณ์แล้ว">
              <Wand2 className="h-2.5 w-2.5" />
              คาดการณ์แล้ว
            </span>
          )}
          {grouped && record.drgCode && (
            <span className="font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">
              {record.drgCode}
            </span>
          )}
          {analyzed && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-400 rounded px-1.5 py-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {auditStatus && auditBadgeStyle && (
            <span
              className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5", auditBadgeStyle)}
              title={`ตรวจชาร์จแล้ว: ${auditStatus.score}/100`}
            >
              <ClipboardList className="h-2.5 w-2.5" />
              {auditStatus.score}
            </span>
          )}
          <ChevronRight className={cn("h-3.5 w-3.5 transition-colors", selected ? "text-primary" : "text-muted-foreground/30")} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {record.wardName && (
          <span className="flex items-center gap-0.5">
            <Building2 className="h-3 w-3" />
            {record.wardName}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Calendar className="h-3 w-3" />
          {record.dchdate}
        </span>
        {record.los && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {record.los}d
          </span>
        )}
      </div>
      {diagnoses[0] && (
        <p className="text-[11px] text-muted-foreground truncate">{diagnoses[0]}</p>
      )}
    </button>
  );
}

/**
 * แถบแดง "รหัสผิดกฎ" เหนือรายการรหัสโรค — ต้องเห็นก่อนอย่างอื่นเพราะเป็นรหัสที่
 * ผู้ตรวจสอบตีกลับแน่นอน ไม่ใช่แค่ข้อสังเกตที่รอ AI ยืนยัน
 */
function CodingRuleBanner({ flags }: { flags: ScreenFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        รหัสผิดกฎการให้รหัสผู้ป่วยใน ({flags.length})
      </div>
      {flags.map((f, i) => (
        <div key={i} className="pl-5.5 space-y-0.5">
          <p className="text-xs font-medium text-red-800 dark:text-red-300">{f.message}</p>
          {f.detail && (
            <p className="text-[11px] text-red-700/80 dark:text-red-400/80 leading-relaxed">{f.detail}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function DiagnosisSection({
  diagnoses,
  result,
  prediag,
}: {
  diagnoses: string[];
  result: AnalyzeResult | null;
  prediag?: string | null;
}) {
  if (!diagnoses.length && !prediag) return null;

  return (
    <div className="space-y-1.5">
      {prediag && (
        <div className="flex items-start gap-1.5 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-2.5 py-2">
          <ClipboardList className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wide">CC / อาการสำคัญ</span>
            <p className="text-xs text-foreground mt-0.5 leading-relaxed">{prediag}</p>
          </div>
        </div>
      )}
      {diagnoses.length > 0 && (
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Stethoscope className="h-3.5 w-3.5" />
        การวินิจฉัย (ICD-10)
      </div>
      )}
      <div className="space-y-1">
        {diagnoses.map((dx, i) => {
          const code = extractCode(dx);
          const desc = dx.slice(code.length).trim();
          const dcs = i === 0
            ? (result?.principal_dcs ?? [])
            : (result?.secondary_dcs?.[code] ?? []);
          const topDcls = dcs.slice(0, 3);
          const mdcLabel = icd10ToMdc(code);
          const ccEntry = result?.cc_mcc_summary?.find((x) => x.code === code);

          return (
            <div key={i} className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-2",
              ccEntry?.level === "MCC"
                ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                : ccEntry?.level === "CC"
                ? "border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
                : "border-border/60 bg-card"
            )}>
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                {i === 0 ? (
                  <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground font-mono">
                    {code}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                    {code}
                  </Badge>
                )}
                {i === 0 && (
                  <span className="text-[10px] text-primary font-medium">หลัก</span>
                )}
                {i > 0 && ccEntry && ccEntry.level !== "not_found" && (
                  <CcMccBadge level={ccEntry.level} />
                )}
                {i > 0 && ccEntry?.level === "not_found" && (
                  <span className="text-[10px] text-muted-foreground/50 border border-dashed border-muted-foreground/30 rounded px-1">DCL ไม่พบ</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {topDcls.map((d) => (
                    <span key={d.dc} className="inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">DC{d.dc}</span>
                      <DclBadge dcl={d.dcl} />
                    </span>
                  ))}
                  {dcs.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dcs.length - 3} DC</span>
                  )}
                  {result && dcs.length === 0 && mdcLabel && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 rounded px-1.5 py-0.5">
                      {mdcLabel}
                    </span>
                  )}
                  {result && dcs.length === 0 && !mdcLabel && (
                    <span className="text-[10px] text-muted-foreground/50">ไม่พบใน DCL</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OperationSection({ operations }: { operations: string[] }) {
  if (!operations.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Scissors className="h-3.5 w-3.5" />
        หัตถการ (ICD-9-CM)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {operations.map((op, i) => (
          <Badge key={i} variant="outline" className="text-xs font-mono">
            {op}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ClinicalDetailSection({ drugs, labs, xrays }: {
  drugs: string[];
  labs: string[];
  xrays: string[];
}) {
  if (!drugs.length && !labs.length && !xrays.length) return null;
  return (
    <div className="space-y-3 pt-1 border-t border-border/60">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        ข้อมูลทางคลินิก
      </p>
      {drugs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Pill className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ยา ({drugs.length} รายการ)
          </div>
          <div className="flex flex-wrap gap-1">
            {drugs.map((d, i) => (
              <span key={i} className="rounded px-2 py-0.5 text-[11px] bg-green-500/10 text-green-700 dark:text-green-400 font-medium">
                {d.length > 50 ? d.slice(0, 50) + "…" : d}
              </span>
            ))}
          </div>
        </div>
      )}
      {labs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            Lab Results ({labs.length} รายการ)
          </div>
          <div className="flex flex-wrap gap-1">
            {labs.map((l, i) => (
              <span key={i} className="rounded px-2 py-0.5 text-[11px] bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-medium">
                {l.length > 60 ? l.slice(0, 60) + "…" : l}
              </span>
            ))}
          </div>
        </div>
      )}
      {xrays.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ScanLine className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            X-Ray / Imaging ({xrays.length} รายการ)
          </div>
          <div className="flex flex-wrap gap-1">
            {xrays.map((x, i) => (
              <span key={i} className="rounded px-2 py-0.5 text-[11px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium">
                {x.length > 60 ? x.slice(0, 60) + "…" : x}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopDcSection({ topDcs }: { topDcs: string[] }) {
  if (!topDcs.length) return null;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
      <p className="text-xs font-semibold text-primary flex items-center gap-1">
        <Database className="h-3.5 w-3.5" />
        DC ที่น่าจะเป็น (พบในหลายรหัสพร้อมกัน)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {topDcs.map((dc) => (
          <span key={dc} className="font-mono text-sm font-bold text-primary bg-primary/10 rounded px-2 py-0.5">
            DC {dc}
          </span>
        ))}
      </div>
    </div>
  );
}

function CcMccBanner({ ccMmcSummary, mdcInfo }: { ccMmcSummary: CcMccEntry[]; mdcInfo?: MdcInfo }) {
  const mccList      = ccMmcSummary.filter(x => x.level === "MCC");
  const ccList       = ccMmcSummary.filter(x => x.level === "CC");
  const noCcList     = ccMmcSummary.filter(x => x.level === "no-CC");
  const notFoundList = ccMmcSummary.filter(x => x.level === "not_found");
  const hasCcMcc = mccList.length > 0 || ccList.length > 0;

  return (
    <div className={cn(
      "rounded-xl border-2 p-4",
      mccList.length > 0
        ? "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
        : ccList.length > 0
        ? "border-orange-400 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30"
        : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20"
    )}>
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center font-bold text-white text-xs",
            mccList.length > 0 ? "bg-red-500" : ccList.length > 0 ? "bg-orange-500" : "bg-amber-400"
          )}>
            {mccList.length > 0 ? "MCC" : ccList.length > 0 ? "CC" : "—"}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {hasCcMcc ? "พบ CC/MCC ในรหัสที่ลงไว้" : "ยังไม่พบ CC/MCC — โอกาสเพิ่ม RW"}
            </p>
            {mdcInfo && (
              <p className="text-[11px] text-muted-foreground">
                MDC {mdcInfo.mdc}: {mdcInfo.name}
              </p>
            )}
          </div>
        </div>
        {!hasCcMcc && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-full px-3 py-1">
            ตรวจสอบรหัสร่วม
          </span>
        )}
      </div>

      {/* Code pills */}
      <div className="flex flex-wrap gap-2">
        {mccList.map(x => (
          <div key={x.code} className="flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-sm font-bold shadow-sm">
            <span className="font-mono">{x.code}</span>
            <span className="text-[10px] bg-white/20 rounded px-1 font-extrabold">MCC · L{x.dcl}</span>
          </div>
        ))}
        {ccList.map(x => (
          <div key={x.code} className="flex items-center gap-1.5 rounded-lg bg-orange-500 text-white px-3 py-1.5 text-sm font-bold shadow-sm">
            <span className="font-mono">{x.code}</span>
            <span className="text-[10px] bg-white/20 rounded px-1 font-extrabold">CC · L{x.dcl}</span>
          </div>
        ))}
        {noCcList.map(x => (
          <div key={x.code} className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{x.code}</span>
            <span className="text-[10px]">L{x.dcl}</span>
          </div>
        ))}
        {notFoundList.map(x => (
          <div key={x.code} className="flex items-center gap-1 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="font-mono font-semibold text-muted-foreground/70">{x.code}</span>
            <span className="text-[10px] text-muted-foreground/50">ไม่พบใน DCL</span>
          </div>
        ))}
      </div>

      {/* If all codes are not_found, show explanation */}
      {notFoundList.length > 0 && !hasCcMcc && noCcList.length === 0 && (
        <p className="mt-2.5 text-[11px] text-amber-700/70 dark:text-amber-400/60">
          รหัสวินิจฉัยร่วมยังไม่มีในตาราง DCL — AI แนะนำรหัสที่ควรเพิ่มไว้ในส่วนคำแนะนำด้านบน
        </p>
      )}
    </div>
  );
}

function AiAnalysisResult({
  analysis,
  ragUsed,
  ccMmcSummary,
  mdcInfo,
}: {
  analysis: string;
  ragUsed: { tdrg633: number; nhso69: number; icd10?: number; icd9?: number };
  ccMmcSummary?: CcMccEntry[];
  mdcInfo?: MdcInfo;
}) {
  const ragSourcesFromAnalyze: Record<string, number> = {
    "ICD-10 WHO 2016": ragUsed.icd10 ?? 0,
    "Thai DRG 6.3.3":  ragUsed.tdrg633 ?? 0,
    "NHSO 69":         ragUsed.nhso69 ?? 0,
    "ICD-9-CM 2015":   ragUsed.icd9 ?? 0,
  };

  return (
    <div className="space-y-3">
      {/* CC/MCC Banner — prominent */}
      {ccMmcSummary && ccMmcSummary.length > 0 && (
        <CcMccBanner ccMmcSummary={ccMmcSummary} mdcInfo={mdcInfo} />
      )}

      {/* AI Analysis */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-500" />
            ผลวิเคราะห์ Coding Consultant
          </div>
        </div>
        <RagSourcesBadges sources={ragSourcesFromAnalyze} />
        <div className="mt-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none
            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-foreground
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-foreground
            [&_strong]:font-bold [&_strong]:text-foreground
            [&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-1.5 [&_p]:text-foreground
            [&_li]:text-sm [&_li]:text-foreground [&_li]:my-0.5
            [&_ul]:my-1.5 [&_ul]:ml-4
            [&_ol]:my-1.5 [&_ol]:ml-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60 text-right italic">
          * ผลนี้เป็นการประมาณการจาก AI — ค่า DRG/RW จริงต้องใช้ ThaiDRG Grouper
        </p>
      </div>
    </div>
  );
}

// ─── RAG Sources Badges ──────────────────────────────────────
const RAG_SOURCE_META: Record<string, { label: string; color: string }> = {
  "ICD-10 WHO 2016": { label: "ICD-10 WHO 2016",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "Thai DRG 6.3.3":  { label: "Thai DRG 6.3.3",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "NHSO 69":         { label: "NHSO 69",           color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  "ICD-9-CM 2015":   { label: "ICD-9-CM 2015",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  "tdrg633":         { label: "Thai DRG 6.3.3",    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "nhso69":          { label: "NHSO 69",           color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  "icd10":           { label: "ICD-10 WHO 2016",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "icd9":            { label: "ICD-9-CM 2015",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  "clinical data":   { label: "ข้อมูลทางคลินิก",  color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

function RagSourcesBadges({ sources }: { sources: Record<string, number> }) {
  const entries = Object.entries(sources).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Database className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground">แหล่งอ้างอิง:</span>
      {entries.map(([key, n]) => {
        const meta = RAG_SOURCE_META[key];
        return (
          <span key={key} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", meta?.color ?? "bg-muted text-muted-foreground")}>
            {meta?.label ?? key}
            <span className="opacity-60">·{n}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── HosXP RW Comparison Card ────────────────────────────────
function HosxpRwCompareCard({ record }: { record: IpdRecord }) {
  const hosxpRw = record.hosxpRw;
  const systemRw = record.rw;
  if (hosxpRw == null || systemRw == null) return null;

  const diff = systemRw - hosxpRw;
  const isHigher = diff > 0.001;
  const isLower  = diff < -0.001;

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 space-y-3",
      isHigher
        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
        : isLower
        ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
        : "border-border bg-muted/30"
    )}>
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">เปรียบเทียบ RW กับ HosXP</span>
        {isHigher && (
          <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 rounded-full px-2 py-0.5">
            ระบบสูงกว่า ▲ +{diff.toFixed(4)}
          </span>
        )}
        {isLower && (
          <span className="ml-auto text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
            ระบบต่ำกว่า ▼ {diff.toFixed(4)}
          </span>
        )}
        {!isHigher && !isLower && (
          <span className="ml-auto text-xs text-muted-foreground">เท่ากัน</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* HosXP column */}
        <div className="rounded-lg border border-border bg-white dark:bg-black/20 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground text-center">HosXP (an_stat)</p>
          <p className="font-mono text-xl font-black text-center text-foreground">{record.hosxpDrg || "—"}</p>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground">RW <span className="font-mono font-bold text-foreground text-sm">{hosxpRw.toFixed(4)}</span></p>
          </div>
        </div>

        {/* System column */}
        <div className={cn(
          "rounded-lg border p-3 space-y-2",
          isHigher
            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : isLower
            ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
            : "border-border bg-white dark:bg-black/20"
        )}>
          <p className="text-[11px] font-semibold text-muted-foreground text-center">ระบบ (AI Grouper)</p>
          <p className={cn(
            "font-mono text-xl font-black text-center",
            isHigher ? "text-emerald-700 dark:text-emerald-400"
            : isLower ? "text-red-600 dark:text-red-400"
            : "text-foreground"
          )}>{record.drgCode || "—"}</p>
          <div className="text-center space-y-0.5">
            <p className="text-[11px] text-muted-foreground">
              RW <span className={cn("font-mono font-bold text-sm", isHigher ? "text-emerald-700 dark:text-emerald-400" : isLower ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                {systemRw.toFixed(4)}
              </span>
            </p>
            {record.adjRw != null && (
              <p className="text-[11px] text-muted-foreground">
                Adj RW <span className="font-mono font-bold text-foreground text-sm">{record.adjRw.toFixed(4)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {isHigher && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 text-center">
          RW ของระบบสูงกว่า HosXP — อาจมีรหัสโรคที่ลงได้เพิ่มเติมซึ่งช่วยให้ได้รับงบประมาณที่เหมาะสม
        </p>
      )}
      {isLower && (
        <p className="text-[11px] text-red-600 dark:text-red-400 text-center">
          RW ของระบบต่ำกว่า HosXP — ตรวจสอบรหัสโรคที่ลงว่าครบถ้วนหรือไม่
        </p>
      )}
      <p className="text-[10px] text-muted-foreground/50 text-center italic">
        * ต้องผ่านการตรวจสอบจาก Certified Coder ก่อนส่งเบิก
      </p>
    </div>
  );
}

// ─── Predicted Codes Cards ────────────────────────────────────
function CodeSourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const meta = RAG_SOURCE_META[source];
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium", meta?.color ?? "bg-muted text-muted-foreground")}>
      <Database className="h-2.5 w-2.5" />
      {meta?.label ?? source}
    </span>
  );
}

function PredictedCodesPanel({
  codes,
  ragSources,
  onAddToDiagnosis,
  prediag,
  operationList,
}: {
  codes: PredictedCode[];
  ragSources?: Record<string, number>;
  onAddToDiagnosis?: (code: PredictedCode) => void;
  prediag?: string | null;
  operationList?: string | null;
}) {
  if (!codes.length) return null;
  const pdxCodes = codes.filter(c => c.type === "PDX");
  const sdxCodes = codes.filter(c => c.type === "SDX");
  const ops = operationList ? operationList.split("|").map(s => s.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="text-sm font-bold text-foreground">รหัสโรคที่ AI คาดการณ์</span>
        <span className="ml-auto rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 text-[10px] font-bold px-2 py-0.5">
          {codes.length} รหัส
        </span>
      </div>

      {/* Clinical input summary — what AI analyzed */}
      {(prediag || ops.length > 0) && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">ข้อมูลที่ AI วิเคราะห์</p>
          {prediag && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">CC:</span>
              <p className="text-[11px] text-foreground leading-relaxed">{prediag}</p>
            </div>
          )}
          {ops.length > 0 && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">ICD-9:</span>
              <p className="text-[11px] text-foreground leading-relaxed">{ops.join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      {/* RAG sources used */}
      {ragSources && <RagSourcesBadges sources={ragSources} />}

      {pdxCodes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">วินิจฉัยหลัก (PDX)</p>
          {pdxCodes.map((c, i) => (
            <div key={i} className="rounded-xl border-l-4 border-l-primary border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-extrabold text-primary bg-primary/10 rounded px-2 py-0.5">{c.code}</span>
                <span className="text-[10px] font-bold rounded-full bg-primary text-primary-foreground px-2 py-0.5">PDX</span>
                <CodeSourceBadge source={c.source} />
                {onAddToDiagnosis && (
                  <button onClick={() => onAddToDiagnosis(c)} className="ml-auto text-[11px] font-semibold text-primary hover:underline">
                    + เลือกเป็น PDX
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">{c.description}</p>
              {c.reason && (
                <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 px-2 py-1.5">
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-0.5">เหตุผล / หลักฐานอ้างอิง</p>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{c.reason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sdxCodes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">วินิจฉัยร่วม (SDX)</p>
          {sdxCodes.map((c, i) => (
            <div key={i} className="rounded-xl border-l-4 border-l-violet-400 border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-extrabold text-violet-700 dark:text-violet-400 bg-violet-500/10 rounded px-2 py-0.5">{c.code}</span>
                <span className="text-[10px] font-bold rounded-full bg-violet-500 text-white px-2 py-0.5">SDX</span>
                <CodeSourceBadge source={c.source} />
                {onAddToDiagnosis && (
                  <button onClick={() => onAddToDiagnosis(c)} className="ml-auto text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                    + เพิ่มเป็น SDX
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">{c.description}</p>
              {c.reason && (
                <div className="rounded border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 px-2 py-1.5">
                  <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-0.5">เหตุผล / หลักฐานอ้างอิง</p>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{c.reason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chart Audit Card ────────────────────────────────────────
// ─── Chart Image Viewer Modal ────────────────────────────────
type DocPageInfo = { page_no: number; ext: string };

function ChartImageViewer({
  itemId, totalPages, docName, onClose,
}: {
  itemId: string; totalPages: number; docName: string; onClose: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState<DocPageInfo[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load available pages list
  useEffect(() => {
    setLoadingPages(true);
    fetch(`/api/chart/pages/${itemId}`)
      .then(r => r.json())
      .then((d: { pages: DocPageInfo[] }) => {
        setPages(d.pages ?? []);
        setLoadingPages(false);
      })
      .catch(() => {
        // Fallback: assume pages 1..totalPages
        setPages(Array.from({ length: Math.min(totalPages, 20) }, (_, i) => ({ page_no: i + 1, ext: "tiff" })));
        setLoadingPages(false);
      });
  }, [itemId, totalPages]);

  const maxPage = pages.length > 0 ? pages[pages.length - 1].page_no : totalPages;
  const imgSrc = `/api/chart/image/${itemId}/${currentPage}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white" onClick={e => e.stopPropagation()}>
        <ScanLine className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium truncate max-w-xs">{docName}</span>
        <span className="text-xs text-gray-400 ml-auto">หน้า {currentPage} / {maxPage}</span>
        {/* Zoom controls */}
        <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 hover:bg-gray-700 rounded" title="ย่อ">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs w-12 text-center">{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(300, z + 25))} className="p-1 hover:bg-gray-700 rounded" title="ขยาย">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded ml-2" title="ปิด">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4" onClick={e => e.stopPropagation()}>
        {loadingPages ? (
          <div className="text-white flex items-center gap-2 mt-20"><Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลด...</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={imgSrc}
            alt={`หน้า ${currentPage}`}
            style={{ width: `${zoom}%`, maxWidth: "none" }}
            className="shadow-2xl bg-white"
            onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-size='14'%3Eไม่สามารถโหลดรูปได้%3C/text%3E%3C/svg%3E"; }}
          />
        )}
      </div>

      {/* Page navigation */}
      <div className="flex items-center justify-center gap-4 py-3 bg-gray-900" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-white rounded text-sm disabled:opacity-40 hover:bg-gray-600"
        >
          <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
        </button>

        {/* Thumbnail strip */}
        <div className="flex gap-1 overflow-x-auto max-w-xs">
          {pages.slice(0, 20).map(p => (
            <button
              key={p.page_no}
              onClick={() => setCurrentPage(p.page_no)}
              className={cn(
                "flex-shrink-0 w-8 h-8 text-xs rounded border",
                currentPage === p.page_no
                  ? "bg-blue-500 border-blue-400 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              )}
            >
              {p.page_no}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentPage(p => Math.min(maxPage, p + 1))}
          disabled={currentPage >= maxPage}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-white rounded text-sm disabled:opacity-40 hover:bg-gray-600"
        >
          ถัดไป <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Chart Audit Result Card ──────────────────────────────────
type ChartDoc = {
  itemID: string; name?: string; date?: string; category?: string;
  sub_category?: string; pages?: string; scan_date?: string;
  downloaded?: boolean; pages_downloaded?: number; pages_cached?: number; pages_total?: number;
};

function AuditScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const cfg = score >= 80
    ? { label: "ผ่านเกณฑ์ดี", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", ring: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" }
    : score >= 60
    ? { label: "ควรปรับปรุง", bar: "bg-amber-400",   text: "text-amber-700 dark:text-amber-400",   ring: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30" }
    : { label: "ต้องแก้ไขด่วน", bar: "bg-red-500",   text: "text-red-700 dark:text-red-400",       ring: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/30" };
  return (
    <div className={cn("rounded-xl p-4 flex items-center gap-4", cfg.bg)}>
      {/* Big score */}
      <div className="text-center shrink-0 w-20">
        <div className={cn("text-5xl font-extrabold tabular-nums leading-none", cfg.ring)}>{score}</div>
        <div className="text-xs text-muted-foreground mt-0.5">/ 100 คะแนน</div>
      </div>
      {/* Bar + label */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-semibold", cfg.text)}>{cfg.label}</span>
        </div>
        <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", cfg.bar)} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span><span>60</span><span>80</span><span>100</span>
        </div>
      </div>
    </div>
  );
}

function AuditSection({
  title, icon: Icon, items, color,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  color: "red" | "amber" | "blue" | "emerald";
}) {
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  const cfg = {
    red:     { header: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300",     dot: "bg-red-500",     item: "text-red-700 dark:text-red-400",   border: "border-red-100 dark:border-red-900" },
    amber:   { header: "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300", dot: "bg-amber-500",   item: "text-amber-700 dark:text-amber-400", border: "border-amber-100 dark:border-amber-900" },
    blue:    { header: "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300",   dot: "bg-blue-500",    item: "text-blue-700 dark:text-blue-400",  border: "border-blue-100 dark:border-blue-900" },
    emerald: { header: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500", item: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-100 dark:border-emerald-900" },
  }[color];
  return (
    <div className={cn("rounded-lg border overflow-hidden", cfg.border)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn("w-full flex items-center gap-2 px-3 py-2 text-left", cfg.header)}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-semibold flex-1">{title}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{items.length}</span>
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1.5 bg-background">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
              <span className={cn("text-xs leading-relaxed", cfg.item)}>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartAuditCard({ result, onRerun, progress }: {
  result: {
    score: number;
    total_docs_found: number;
    summary: string;
    missing_items: string[];
    issues: string[];
    recommendations: string[];
    nhso_missing_docs?: string[];
    nhso_audit_issues?: string[];
    text_extracted: boolean;
    doc_list?: ChartDoc[];
    audited_at?: string;
    ocr_in_progress?: boolean;
    pages_pending?: number;
    total_pages?: number;
  };
  onRerun?: () => void;
  /** ความคืบหน้า background OCR แบบสดจากการ poll — สดกว่าค่าใน result */
  progress?: { status: string; pages_done: number; pages_total: number; rate?: number; etaMin?: number };
}) {
  const [viewerDoc, setViewerDoc] = useState<ChartDoc | null>(null);
  const [checkedRecs, setCheckedRecs] = useState<Set<number>>(new Set());

  const toggleRec = (i: number) =>
    setCheckedRecs(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const auditedAt = result.audited_at
    ? new Date(result.audited_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const docsWithFile = (result.doc_list ?? []).filter(d => d.itemID);

  return (
    <>
      {viewerDoc && (
        <ChartImageViewer
          itemId={viewerDoc.itemID}
          totalPages={viewerDoc.pages_total ?? parseInt(viewerDoc.pages ?? "1")}
          docName={[viewerDoc.name, viewerDoc.category, viewerDoc.sub_category].filter(Boolean).join(" / ")}
          onClose={() => setViewerDoc(null)}
        />
      )}

      <Card>
        {/* ── Header ── */}
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-500" />
              ผลตรวจชาร์จ (Medical Record Audit)
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {auditedAt && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  ตรวจเมื่อ {auditedAt}
                </span>
              )}
              {!result.text_extracted && !result.ocr_in_progress && (
                <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded px-2 py-0.5">
                  ⚠ ประเมินจาก Metadata
                </span>
              )}
              {result.ocr_in_progress && (
                <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 animate-pulse">
                  OCR กำลังประมวลผล...
                </span>
              )}
              {result.text_extracted && !result.ocr_in_progress && (
                <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded px-2 py-0.5">
                  ✓ OCR ครบถ้วน
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">

          {/* ── Score gauge ── */}
          <AuditScoreGauge score={result.score} />

          {/* ── Document info row ── */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <ScanLine className="h-3.5 w-3.5" />
              พบเอกสาร <strong className="text-foreground">{result.total_docs_found}</strong> รายการ
            </span>
            {(result.doc_list ?? []).map((doc, i) => doc.pages_total != null && (
              <span key={i} className="flex items-center gap-1">
                <FileSearch className="h-3.5 w-3.5" />
                OCR <strong className="text-foreground">{doc.pages_downloaded}</strong>/{doc.pages_total} หน้า
                {(doc.pages_cached ?? 0) > 0 && <span className="text-emerald-600">(cached)</span>}
              </span>
            ))}
          </div>

          {/* ── OCR in-progress banner ── */}
          {result.ocr_in_progress && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">⏳</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  OCR กำลังประมวลผลหน้าที่เหลืออยู่ในพื้นหลัง
                  {progress && progress.pages_total > 0 ? (
                    <span className="font-normal">
                      {" — "}{progress.pages_done}/{progress.pages_total} หน้า
                      {progress.etaMin != null && progress.etaMin > 0 && (
                        <> · เหลืออีก ~{progress.etaMin < 1 ? "ไม่ถึง 1" : Math.ceil(progress.etaMin)} นาที</>
                      )}
                    </span>
                  ) : result.pages_pending != null && result.total_pages != null && (
                    <span className="font-normal"> — เหลือ {result.pages_pending}/{result.total_pages} หน้า</span>
                  )}
                </p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                  ระบบจะตรวจชาร์จซ้ำให้อัตโนมัติเมื่อ OCR ครบทุกหน้า — หรือกด &ldquo;ตรวจใหม่&rdquo; เพื่อดูผลตอนนี้
                </p>
              </div>
              {onRerun && (
                <button
                  onClick={onRerun}
                  className="shrink-0 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded px-2 py-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                >
                  ตรวจใหม่
                </button>
              )}
            </div>
          )}

          {/* ── Summary box ── */}
          <div className="rounded-lg bg-muted/50 border px-3 py-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">สรุปผล</p>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>

          {/* ── Sections ── */}
          <div className="space-y-2">
            <AuditSection title="รายการที่ขาด / ไม่ครบถ้วน" icon={AlertCircle} items={result.missing_items ?? []} color="red" />
            <AuditSection title="ปัญหาที่พบ" icon={ShieldAlert} items={result.issues ?? []} color="amber" />
          </div>

          {/* ── Recommendations as checklist ── */}
          {(result.recommendations?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-blue-100 dark:border-blue-900 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-semibold flex-1">คำแนะนำสำหรับเจ้าหน้าที่</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                  {checkedRecs.size}/{result.recommendations.length}
                </span>
              </div>
              <ul className="px-3 py-2 space-y-1.5 bg-background">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    onClick={() => toggleRec(i)}
                    className="flex gap-2.5 items-start cursor-pointer group"
                  >
                    <div className={cn(
                      "mt-0.5 h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                      checkedRecs.has(i)
                        ? "bg-blue-500 border-blue-500"
                        : "border-muted-foreground/40 group-hover:border-blue-400",
                    )}>
                      {checkedRecs.has(i) && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs leading-relaxed transition-colors",
                      checkedRecs.has(i) ? "line-through text-muted-foreground" : "text-blue-700 dark:text-blue-400",
                    )}>
                      {rec}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── NHSO Audit sections ── */}
          {((result.nhso_missing_docs?.length ?? 0) > 0 || (result.nhso_audit_issues?.length ?? 0) > 0) && (
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-semibold">เอกสารประกอบ สปสช. (NHSO Claim Audit)</span>
              </div>
              <div className="px-3 py-2.5 bg-background space-y-3">
                {(result.nhso_audit_issues?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1.5">
                      ประเด็นที่อาจถูก สปสช. ตรวจสอบ / ปฏิเสธการจ่าย
                    </p>
                    <ul className="space-y-1">
                      {result.nhso_audit_issues!.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-red-700 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.nhso_missing_docs?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                      เอกสารที่ต้องจัดเตรียมเพิ่มเติมสำหรับการเบิก
                    </p>
                    <ul className="space-y-1">
                      {result.nhso_missing_docs!.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                          <PlusCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Document cards ── */}
          {(result.doc_list?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">เอกสารที่พบในระบบ</p>
              {result.doc_list!.map((doc, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  {/* doc header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                        <ScanLine className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{doc.name || `เอกสาร #${i + 1}`}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[doc.category, doc.sub_category].filter(Boolean).join(" › ")}
                        </p>
                      </div>
                    </div>
                    {doc.itemID && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 shrink-0"
                        onClick={() => setViewerDoc(doc)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        ดูไฟล์สแกน
                      </Button>
                    )}
                  </div>
                  {/* doc metadata grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] pl-9">
                    {doc.date && (
                      <span className="text-muted-foreground flex gap-1"><Calendar className="h-3 w-3 mt-0.5 shrink-0"/>วันที่ Admit: <strong className="text-foreground">{doc.date}</strong></span>
                    )}
                    {doc.scan_date && (
                      <span className="text-muted-foreground flex gap-1"><ScanLine className="h-3 w-3 mt-0.5 shrink-0"/>วันที่สแกน: <strong className="text-foreground">{doc.scan_date}</strong></span>
                    )}
                    {doc.pages_total != null ? (
                      <span className="text-muted-foreground flex gap-1 col-span-2">
                        <FileSearch className="h-3 w-3 mt-0.5 shrink-0"/>
                        หน้าทั้งหมด: <strong className="text-foreground">{doc.pages_total} หน้า</strong>
                        <span className="mx-1">·</span>
                        OCR แล้ว: <strong className={cn(doc.pages_downloaded === doc.pages_total ? "text-emerald-600" : "text-amber-600")}>{doc.pages_downloaded} หน้า</strong>
                        {(doc.pages_cached ?? 0) > 0 && <span className="text-emerald-600 ml-1">(cached {doc.pages_cached})</span>}
                      </span>
                    ) : doc.pages ? (
                      <span className="text-muted-foreground flex gap-1"><FileSearch className="h-3 w-3 mt-0.5 shrink-0"/>จำนวนหน้า: <strong className="text-foreground">{doc.pages} หน้า</strong></span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </>
  );
}

// ─── Eval Row (expandable actual codes) ──────────────────────
function EvalRow({
  row, pdxCode, sdxCodes, actualPdxCode, actualSdxRaw, pendingActual, fmtDate,
}: {
  row: AiPredictionRow;
  pdxCode: PredictedCode | undefined;
  sdxCodes: PredictedCode[];
  actualPdxCode: string | null;
  actualSdxRaw: string[];
  pendingActual: boolean;
  fmtDate: (iso: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = row.dchdate ?? row.admdate ?? row.createdAt;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top">
      {/* AN / วันจำหน่าย */}
      <td className="px-3 py-2.5">
        <div className="font-mono font-medium text-xs">{row.an}</div>
        <div className="text-[10px] text-muted-foreground">{fmtDate(dateLabel)}</div>
        {row.wardName && <div className="text-[10px] text-muted-foreground truncate max-w-[96px]">{row.wardName}</div>}
      </td>
      {/* Model */}
      <td className="px-3 py-2.5">
        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
          {row.model.split(":")[0]}
        </span>
      </td>
      {/* Predicted codes */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {pdxCode && (
            <div className="w-full">
              <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-[10px] font-mono font-semibold">
                {pdxCode.code} PDX
              </span>
              {(pdxCode as PredictedCode).description && (
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {(pdxCode as PredictedCode).description}
                </div>
              )}
            </div>
          )}
          {sdxCodes.slice(0, 3).map(c => (
            <span key={c.code} className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-mono">
              {c.code}
            </span>
          ))}
          {sdxCodes.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{sdxCodes.length - 3}</span>
          )}
        </div>
      </td>
      {/* Actual codes */}
      <td className="px-3 py-2.5">
        {pendingActual ? (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">รอรหัส</span>
        ) : (
          <div className="space-y-1">
            {/* PDX actual */}
            {actualPdxCode && (
              <div>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold",
                  row.pdxMatch
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                )}>
                  {actualPdxCode} PDX
                </span>
                {row.prediag && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight max-w-[160px] truncate" title={row.prediag}>
                    {row.prediag}
                  </div>
                )}
              </div>
            )}
            {/* SDX actual — collapsed by default */}
            {!expanded && actualSdxRaw.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                {actualSdxRaw.slice(0, 2).map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-mono">
                    {extractIcd(c)}
                  </span>
                ))}
                {actualSdxRaw.length > 2 && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    +{actualSdxRaw.length - 2} ดูทั้งหมด
                  </button>
                )}
              </div>
            )}
            {/* Expanded SDX */}
            {expanded && (
              <div className="space-y-0.5">
                <div className="flex flex-wrap gap-1">
                  {actualSdxRaw.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-mono">
                      {extractIcd(c)}
                    </span>
                  ))}
                </div>
                <button onClick={() => setExpanded(false)} className="text-[10px] text-muted-foreground hover:underline">
                  ย่อ
                </button>
              </div>
            )}
          </div>
        )}
      </td>
      {/* PDX Match */}
      <td className="px-3 py-2.5 text-center">
        {pendingActual ? (
          <span className="text-muted-foreground">—</span>
        ) : row.pdxMatch ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-400 inline" />
        )}
      </td>
      {/* Coverage */}
      <td className="px-3 py-2.5 text-center tabular-nums">
        {row.codeCoverage != null
          ? <span className={cn("font-medium text-xs", row.codeCoverage >= 0.6 ? "text-green-600" : row.codeCoverage >= 0.3 ? "text-amber-600" : "text-red-500")}>{Math.round(row.codeCoverage * 100)}%</span>
          : <span className="text-muted-foreground">—</span>}
      </td>
      {/* Recall */}
      <td className="px-3 py-2.5 text-center tabular-nums">
        {row.recall != null
          ? <span className={cn("font-medium text-xs", row.recall >= 0.6 ? "text-green-600" : row.recall >= 0.3 ? "text-amber-600" : "text-red-500")}>{Math.round(row.recall * 100)}%</span>
          : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}

// ─── AI Evaluation View ──────────────────────────────────────
function AiEvaluationView() {
  const [evalDateFrom, setEvalDateFrom] = useState("");
  const [evalDateTo,   setEvalDateTo]   = useState("");
  const [evalPage,     setEvalPage]     = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-predictions", evalDateFrom, evalDateTo, evalPage],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(evalPage), limit: "20" });
      if (evalDateFrom) p.set("dateFrom", evalDateFrom);
      if (evalDateTo)   p.set("dateTo",   evalDateTo);
      const res = await fetch(`/api/ai-predictions?${p}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json() as Promise<{ predictions: AiPredictionRow[]; total: number; page: number; limit: number }>;
    },
  });

  const rows      = data?.predictions ?? [];
  const totalAll  = data?.total ?? 0;
  const totalPages = Math.ceil(totalAll / 20);

  // Aggregate stats only from records that have actual diagnosis (evaluated)
  const evaluated    = rows.filter(r => r.currentActual);
  const pdxMatchRate = evaluated.length
    ? Math.round(evaluated.filter(r => r.pdxMatch).length / evaluated.length * 100)
    : null;
  const avgCoverage  = evaluated.length
    ? Math.round(evaluated.reduce((s, r) => s + (r.codeCoverage ?? 0), 0) / evaluated.length * 100)
    : null;
  const avgRecall    = evaluated.length
    ? Math.round(evaluated.reduce((s, r) => s + (r.recall ?? 0), 0) / evaluated.length * 100)
    : null;

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" }); }
    catch { return iso.slice(0, 10); }
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Predictions ทั้งหมด", value: totalAll,    color: "text-foreground" },
          { label: "PDX Match Rate",       value: pdxMatchRate != null ? `${pdxMatchRate}%` : "—", color: "text-green-600"  },
          { label: "Code Coverage",        value: avgCoverage  != null ? `${avgCoverage}%`  : "—", color: "text-blue-600"   },
          { label: "Recall",               value: avgRecall    != null ? `${avgRecall}%`    : "—", color: "text-violet-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-bold mt-0.5 tabular-nums", color)}>{value}</p>
              {evaluated.length > 0 && label !== "Predictions ทั้งหมด" && (
                <p className="text-[10px] text-muted-foreground mt-0.5">จาก {evaluated.length} ราย มีรหัสจริงแล้ว</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">วันจำหน่าย</span>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input type="date" value={evalDateFrom} onChange={e => { setEvalDateFrom(e.target.value); setEvalPage(1); }} className="h-8 text-xs w-36" />
        <span className="text-muted-foreground text-xs">–</span>
        <Input type="date" value={evalDateTo}   onChange={e => { setEvalDateTo(e.target.value);   setEvalPage(1); }} className="h-8 text-xs w-36" />
        {(evalDateFrom || evalDateTo) && (
          <button onClick={() => { setEvalDateFrom(""); setEvalDateTo(""); setEvalPage(1); }} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
        )}
        <button onClick={() => refetch()} className="p-1 text-muted-foreground hover:text-foreground" title="refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-muted-foreground ml-auto">{totalAll} รายการ</span>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-28">AN / วันที่</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-24">Model</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">คาดการณ์</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">รหัสจริง</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-16">PDX</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-20">Coverage</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-16">Recall</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูล — กดคาดการณ์รหัสโรคก่อน</td></tr>
              ) : rows.map(row => {
                const pdxCode = row.predictedCodes.find(c => c.type === "PDX");
                const sdxCodes = row.predictedCodes.filter(c => c.type === "SDX");
                const actualRaw = parsePipe(row.currentActual);
                // actual PDX = diagtype "1:" (principal), rest are SDX
                const actualPdxRaw = actualRaw.find(c => c.startsWith("1:")) ?? actualRaw[0] ?? null;
                const actualPdxCode = actualPdxRaw ? extractIcd(actualPdxRaw) : null;
                const actualSdxRaw = actualRaw.filter(c => c !== actualPdxRaw);
                const pendingActual = !row.currentActual;

                return (
                  <EvalRow
                    key={row.id}
                    row={row}
                    pdxCode={pdxCode}
                    sdxCodes={sdxCodes}
                    actualPdxCode={actualPdxCode}
                    actualSdxRaw={actualSdxRaw}
                    pendingActual={pendingActual}
                    fmtDate={fmtDate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setEvalPage(p => Math.max(1, p - 1))}
            disabled={evalPage === 1}
            className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-accent"
          >‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = Math.max(1, Math.min(evalPage - 2, totalPages - 4)) + i;
            return (
              <button
                key={pg}
                onClick={() => setEvalPage(pg)}
                className={cn("w-7 h-7 rounded border text-xs", evalPage === pg ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >{pg}</button>
            );
          })}
          <button
            onClick={() => setEvalPage(p => Math.min(totalPages, p + 1))}
            disabled={evalPage === totalPages}
            className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-accent"
          >›</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function DrgAnalyzerPage() {
  const [search, setSearch]               = useState("");
  const [analyzedFilter, setAnalyzedFilter] = useState("all");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [wardFilter, setWardFilter]       = useState("");
  const [listPage, setListPage]           = useState(1);
  const [selectedRecord, setSelectedRecord]   = useState<IpdRecord | null>(null);
  const [mobilePanel, setMobilePanel]         = useState<"list" | "detail">("list");
  const [analyzeResult, setAnalyzeResult]     = useState<AnalyzeResult | null>(null);
  const [analyzeError, setAnalyzeError]       = useState<string | null>(null);
  const [selectedModel, setSelectedModel]     = useState("qwen3.5:9b");

  const { data: aiModels } = useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const res = await fetch("/api/settings/models");
      return res.json() as Promise<{ id: string; name: string; modelId: string; isDefault: boolean }[]>;
    },
  });

  useEffect(() => {
    const def = aiModels?.find(m => m.isDefault);
    if (def) setSelectedModel(def.modelId);
  }, [aiModels]);
  const [grouperResult, setGrouperResult]     = useState<GrouperResult | null>(null);
  const [grouperError, setGrouperError]       = useState<string | null>(null);
  const [batchRunning, setBatchRunning]       = useState(false);
  const [batchResult, setBatchResult]         = useState<{ processed: number; failed: number; remaining: number } | null>(null);
  const [selectedSuggestionCodes, setSelectedSuggestionCodes] = useState<Set<string>>(new Set());
  const [originalGrouperResult, setOriginalGrouperResult]   = useState<GrouperResult | null>(null);
  const [compareGrouperResult, setCompareGrouperResult]     = useState<GrouperResult | null>(null);
  const [compareRunning, setCompareRunning]                 = useState(false);
  const [compareError, setCompareError]                     = useState<string | null>(null);
  const [aiAnalysisStreaming, setAiAnalysisStreaming]       = useState<string>("");
  const [predictedCodes, setPredictedCodes]                 = useState<PredictedCode[]>([]);
  const [predictError, setPredictError]                     = useState<string | null>(null);
  const [predictStreaming, setPredictStreaming]              = useState<string>("");
  const [predictRunning, setPredictRunning]                 = useState(false);
  const [mainView,       setMainView]                       = useState<"analyzer" | "evaluation">("analyzer");
  const [predictRagSources, setPredictRagSources]           = useState<Record<string, number>>({});
  type ChartAuditResult = {
    score: number;
    total_docs_found: number;
    summary: string;
    missing_items: string[];
    issues: string[];
    recommendations: string[];
    nhso_missing_docs?: string[];
    nhso_audit_issues?: string[];
    text_extracted: boolean;
    doc_list?: Array<{ itemID: string; name?: string; date?: string; category?: string; sub_category?: string; pages?: string; scan_date?: string; downloaded?: boolean; pages_downloaded?: number; pages_cached?: number; pages_total?: number }>;
    audited_at?: string;
    ocr_in_progress?: boolean;
    pages_pending?: number;
    total_pages?: number;
  };
  const [chartAuditResults, setChartAuditResults]           = useState<Record<string, ChartAuditResult>>({});
  /** เคสที่ OCR อ่านได้ไม่พอจะไม่มีคะแนน — เก็บไว้แสดงสถานะแทนตัวเลข */
  const [chartAuditPending, setChartAuditPending]           = useState<Record<string, { summary: string; pages_readable: number; total_pages: number; pages_needed: number }>>({});
  const [chartAuditLoading, setChartAuditLoading]           = useState(false);
  const [chartAuditError, setChartAuditError]               = useState<string | null>(null);
  const [auditStatuses, setAuditStatuses]                   = useState<Record<string, { score: number; auditedAt: string }>>({});
  const [ocrProgress, setOcrProgress]                       = useState<Record<string, { status: string; pages_done: number; pages_total: number; rate?: number; etaMin?: number }>>({});
  /** จุดอ้างอิงแรกของแต่ละ AN — ใช้คำนวณความเร็วจริง (หน้า/นาที) ซึ่งช้าลงตามคิวที่ค้าง */
  const ocrSample                                           = useRef<Record<string, { t: number; done: number }>>({});
  /** AN ที่ตรวจซ้ำอัตโนมัติไปแล้ว — กันไม่ให้ยิงซ้ำวนไม่รู้จบ */
  const autoRerunDone                                       = useRef<Set<string>>(new Set());

  // เปิดจากลิงก์ในแจ้งเตือน: ?flagged=1 = เข้าโหมดกรองรหัสผิดกฎ · ?an=xxx = ค้นเคสนั้นเลย
  // ตั้งค่าใน effect (ไม่ใช่ค่าตั้งต้นของ useState) เพราะ SSR ไม่มี window — ถ้าอ่านตอน render
  // ฝั่ง server กับ client จะได้คนละค่าแล้ว hydration พัง
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const an = q.get("an");
    if (an) setSearch(an);
    if (q.get("flagged") === "1") setAnalyzedFilter("flagged");
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ipd-records", search, analyzedFilter, dateFrom, dateTo, wardFilter, listPage],
    queryFn:  () => fetchRecords(
      search, analyzedFilter === "all" ? "" : analyzedFilter,
      dateFrom, dateTo, wardFilter, listPage,
    ),
    staleTime: 30_000,
  });

  const { data: wardsData } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn:  fetchWards,
    staleTime: 300_000,
  });

  // Fetch chart audit statuses whenever the record list changes
  useEffect(() => {
    const records = data?.records;
    if (!records?.length) return;
    const ans = records.map((r) => r.an).join(",");
    fetch(`/api/chart/audit-status?ans=${encodeURIComponent(ans)}`)
      .then((r) => r.json())
      .then((statuses) => setAuditStatuses((prev) => ({ ...prev, ...statuses })))
      .catch(() => {/* ignore */});
  }, [data?.records]);

  // Reset page when any filter changes
  const resetPage = () => setListPage(1);

  const analyzeMutation = useMutation({
    mutationFn: (record: IpdRecord) => {
      setAiAnalysisStreaming("");
      return analyzeRecord(record, selectedModel, setAiAnalysisStreaming);
    },
    onSuccess: (result) => {
      setAiAnalysisStreaming("");
      setAnalyzeResult(result);
      setAnalyzeError(null);
      setSelectedSuggestionCodes(new Set());
      setCompareGrouperResult(null);
      refetch();
    },
    onError: (err: Error) => {
      setAiAnalysisStreaming("");
      setAnalyzeError(err.message);
      setAnalyzeResult(null);
    },
  });

  const grouperMutation = useMutation({
    mutationFn: ({ record, overrideCodes }: { record: IpdRecord; overrideCodes?: PredictedCode[] }) =>
      runGrouper(record, overrideCodes),
    onSuccess: (result) => {
      setGrouperResult(result);
      setGrouperError(null);
      // Update selectedRecord ด้วยค่า rw/adjRw/drgCode ล่าสุดจาก grouper
      // เพื่อให้ HosxpRwCompareCard แสดงผลได้ทันที โดยไม่ต้องรอ refetch
      setSelectedRecord(prev => prev ? {
        ...prev,
        drgCode:      result.drg_code,
        rw:           result.rw,
        adjRw:        result.adj_rw,
        drgGroupedAt: new Date().toISOString(),
      } : prev);
      refetch();
    },
    onError: (err: Error) => {
      setGrouperError(err.message);
    },
  });

  function toggleSuggestionCode(code: string) {
    setSelectedSuggestionCodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
    setCompareGrouperResult(null); // reset comparison when selection changes
  }

  async function runCompareGrouper() {
    if (!selectedRecord || selectedSuggestionCodes.size === 0) return;
    setCompareRunning(true);
    setCompareGrouperResult(null);
    setCompareError(null);

    // Store current result as original baseline
    const baseline = grouperResult ?? null;

    const diagnoses  = parsePipe(selectedRecord.diagnosisList);
    const operations = parsePipe(selectedRecord.operationList);
    const pdx = extractIcd(diagnoses[0] ?? "");
    const sdx = diagnoses.slice(1).map(extractIcd).filter(Boolean);
    const procs = operations.map(o => o.split(/\s+/)[0].replace(/^\d+:/, "").toUpperCase()).filter(Boolean);

    // Normalize existing codes (HOSxP stores without dots: E059, 8541)
    const sdxNorm  = sdx.map(normIcd);
    const procsNorm = procs.map(normIcd);

    // Classify additional codes: ICD-10 (starts with letter) or ICD-9 (numeric)
    // Filter out codes already in existing SDx/procs (compare without dots: E05.9 === E059)
    const addSdx: string[] = [];
    const addProcs: string[] = [];
    for (const code of selectedSuggestionCodes) {
      const norm = normIcd(code);
      if (/^[A-Z]/i.test(norm)) {
        if (!sdxNorm.includes(norm)) addSdx.push(norm); // send without dot
      } else {
        if (!procsNorm.includes(norm)) addProcs.push(norm);
      }
    }

    console.log("[DRG Compare] PDx:", pdx);
    console.log("[DRG Compare] Original SDx:", sdx);
    console.log("[DRG Compare] New codes to add:", [...addSdx, ...addProcs]);
    console.log("[DRG Compare] All selected:", [...selectedSuggestionCodes]);

    const body = {
      an: selectedRecord.an,
      principal_dx: pdx,
      secondary_dx: [...sdx, ...addSdx],
      operations:   [...procs, ...addProcs],
      sex:    selectedRecord.sex ?? "",
      age:    selectedRecord.ageY ? parseInt(selectedRecord.ageY) : 0,
      agemon: computeAgemon(selectedRecord),
      los:    computeLos(selectedRecord),
      disch:  mapDischarge(selectedRecord.dchtype),
    };

    try {
      // If no original DRG yet, run it first
      let orig = baseline;
      if (!orig) {
        const res0 = await fetch("/api/drg/run-grouper", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, secondary_dx: sdx, operations: procs }),
        });
        if (res0.ok) orig = await res0.json();
      }
      if (orig) setOriginalGrouperResult(orig);

      // Run with added codes
      const res = await fetch("/api/drg/run-grouper", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const result = await res.json();
        setCompareGrouperResult(result);
        if (orig) setOriginalGrouperResult(orig);
        if (!grouperResult) setGrouperResult(orig);
      } else {
        const err = await res.json().catch(() => ({}));
        setCompareError(err.error ?? "Grouper failed");
      }
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setCompareRunning(false);
    }
  }

  async function runChartAudit(an: string, auto = false) {
    // กดเองถือว่าเริ่มรอบใหม่ — เปิดให้ตรวจซ้ำอัตโนมัติได้อีกครั้ง
    if (!auto) autoRerunDone.current.delete(an);
    setChartAuditLoading(true);
    setChartAuditError(null);
    const rec = records.find((r) => r.an === an);
    try {
      const res = await fetch("/api/chart/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          an,
          hn:        rec?.hn ?? undefined,
          ward:      rec?.wardName ?? rec?.wardCode ?? undefined,
          prediag:   rec?.prediag ?? undefined,
          diagnosis: rec?.diagnosisList ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      if (typeof data.score !== "number") {
        // OCR อ่านได้ไม่พอ — ไม่มีคะแนนให้แสดง ล้างผลเก่าออกกันเข้าใจผิด
        setChartAuditPending((prev) => ({
          ...prev,
          [an]: {
            summary:        data.summary ?? "ยังประเมินไม่ได้",
            pages_readable: data.pages_readable ?? 0,
            total_pages:    data.total_pages ?? 0,
            pages_needed:   data.pages_needed ?? 0,
          },
        }));
        setChartAuditResults((prev) => {
          const next = { ...prev };
          delete next[an];
          return next;
        });
        return;
      }
      setChartAuditPending((prev) => {
        const next = { ...prev };
        delete next[an];
        return next;
      });
      setChartAuditResults((prev) => ({ ...prev, [an]: data }));
      setAuditStatuses((prev) => ({ ...prev, [an]: { score: data.score, auditedAt: new Date().toISOString() } }));
    } catch (e) {
      setChartAuditError(e instanceof Error ? e.message : "Failed");
    } finally {
      setChartAuditLoading(false);
    }
  }

  async function predictIcdCodes(record: IpdRecord) {
    setPredictRunning(true);
    setPredictedCodes([]);
    setPredictError(null);
    setPredictStreaming("");

    const body = {
      an:             record.an,
      prediag:        record.prediag ?? "",
      drug_list:      parsePipe(record.drugList),
      lab_results:    parsePipe(record.labResults),
      xray_list:      parsePipe(record.xrayList),
      operation_list: parsePipe(record.operationList),
      ward:                record.wardName ?? record.wardCode ?? "",
      los:                 record.los ?? "",
      sex:                 record.sex ?? "",
      age:                 record.ageY ?? "",
      vital_signs:         parsePipe(record.vitalSigns),
      underlying_diseases: parsePipe(record.underlyingDiseases),
      model:               selectedModel,
    };

    try {
      const res = await fetch("/api/drg/predict-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Predict failed");
      }
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === "token") {
              setPredictStreaming(prev => prev + (obj.text ?? ""));
            } else if (obj.type === "done") {
              const codes = obj.predicted_codes ?? [];
              setPredictedCodes(codes);
              setPredictRagSources(obj.rag_sources ?? {});
              // Auto-save to DB for R&D (fire-and-forget)
              if (codes.length > 0) {
                fetch("/api/ai-predictions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    an:             record.an,
                    model:          body.model,
                    prediag:        body.prediag,
                    drugList:       record.drugList       ?? null,
                    labResults:     record.labResults     ?? null,
                    xrayList:       record.xrayList       ?? null,
                    operationList:  record.operationList  ?? null,
                    predictedCodes: codes,
                    aiAnalysis:     obj.aiAnalysis        ?? "",
                  }),
                }).catch(() => { /* silent — don't block UI */ });
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setPredictRunning(false);
      setPredictStreaming("");
    }
  }

  async function runBatchGrouper() {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/drg/batch-grouper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      setBatchResult(data);
      refetch();
    } catch {
      setBatchResult({ processed: 0, failed: 0, remaining: -1 });
    } finally {
      setBatchRunning(false);
    }
  }

  const handleSelectRecord = useCallback((record: IpdRecord) => {
    setSelectedRecord(record);
    setMobilePanel("detail");
    setAnalyzeResult(null);
    setAnalyzeError(null);
    setGrouperResult(null);
    setGrouperError(null);
    setSelectedSuggestionCodes(new Set());
    setOriginalGrouperResult(null);
    setCompareGrouperResult(null);
    setCompareError(null);
    setPredictedCodes([]);
    setPredictError(null);
    setPredictStreaming("");
    setPredictRagSources({});
    setChartAuditError(null);
    // Auto-load chart audit result from DB if not already in local state
    if (!chartAuditResults[record.an]) {
      fetch(`/api/chart/audit-result/${encodeURIComponent(record.an)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((result) => {
          if (result && typeof result.score === "number") {
            setChartAuditResults((prev) => ({ ...prev, [record.an]: result }));
            setAuditStatuses((prev) => ({ ...prev, [record.an]: { score: result.score, auditedAt: result.audited_at ?? new Date().toISOString() } }));
          }
        })
        .catch(() => { /* silent */ });
    }
    // Auto-load latest AI prediction if exists
    if (record._count?.aiPredictions && record._count.aiPredictions > 0) {
      fetch(`/api/ai-predictions?an=${encodeURIComponent(record.an)}&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          const latest = data?.predictions?.[0];
          if (latest?.predictedCodes?.length > 0) {
            setPredictedCodes(latest.predictedCodes);
          }
        })
        .catch(() => { /* silent */ });
    }
    // Auto-load previous grouper result if exists
    if (record.drgCode && record.rw != null) {
      setGrouperResult({
        an:           record.an,
        drg_code:     record.drgCode,
        rw:           record.rw,
        adj_rw:       record.adjRw ?? record.rw,
        wtlos:        0,
        outlier_type: 0,
        error_code:   0,
      });
    }
    // Auto-load previous analysis if exists
    if (record.aiAnalysis && record.aiAnalyzedAt) {
      const diagnoses = parsePipe(record.diagnosisList);
      const { cleanText, suggestions } = extractSuggestionsFromText(record.aiAnalysis);
      setAnalyzeResult({
        an:            record.an,
        principal_dx:  extractIcd(diagnoses[0] ?? ""),
        principal_dcs: [],
        secondary_dcs: {},
        top_dcs:       [],
        rag_used:      { tdrg633: 0, nhso69: 0 },
        aiAnalysis:    cleanText,
        suggestions,
        version:       "6.3.3",
      });
    }
  }, [chartAuditResults]);

  // คำขอตรวจชาร์จคืนผลจากหน้าที่ OCR ไว้แล้วทันที ไม่รอให้ครบ (กัน 524 ของ Cloudflare
  // ที่ตัดที่ 100 วินาที) หน้าที่เหลือ FastAPI ทำต่อในพื้นหลัง — ตรงนี้จึง poll ความคืบหน้า
  // แล้วสั่งตรวจซ้ำให้เองเมื่อ OCR ครบ ผู้ใช้ไม่ต้องคอยกดปุ่มเอง
  const auditAn    = selectedRecord?.an;
  // ยัง poll ต่อทั้งกรณีมีผลแล้วแต่ OCR ยังไม่ครบ และกรณียังให้คะแนนไม่ได้เพราะอ่านได้ไม่พอ
  const ocrRunning = auditAn
    ? chartAuditResults[auditAn]?.ocr_in_progress === true || chartAuditPending[auditAn] != null
    : false;

  useEffect(() => {
    if (!auditAn || !ocrRunning) return;
    let cancelled = false;
    let id: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      try {
        const res = await fetch(`/api/chart/ocr-status/${encodeURIComponent(auditAn)}`);
        if (!res.ok || cancelled) return;
        const s = await res.json();
        if (cancelled) return;
        const now  = Date.now();
        const done = s.pages_done ?? 0;
        const tot  = s.pages_total ?? 0;
        // ตั้งจุดอ้างอิงใหม่ถ้ายังไม่มี หรือ bg OCR เริ่มรอบใหม่ (นับถอยหลัง)
        const base = ocrSample.current[auditAn];
        if (!base || done < base.done) ocrSample.current[auditAn] = { t: now, done };
        const ref     = ocrSample.current[auditAn];
        const elapsed = (now - ref.t) / 60_000;
        const advanced = done - ref.done;
        let rate: number | undefined;
        let etaMin: number | undefined;
        if (elapsed >= 0.4 && advanced > 0) {
          rate   = advanced / elapsed;
          etaMin = Math.max(0, tot - done) / rate;
        }
        setOcrProgress((prev) => ({
          ...prev,
          [auditAn]: { status: s.status ?? "idle", pages_done: done, pages_total: tot, rate, etaMin },
        }));
        if (s.status !== "done") return;
        if (!autoRerunDone.current.has(auditAn)) {
          autoRerunDone.current.add(auditAn);
          runChartAudit(auditAn, true);
          return;
        }
        // OCR ลองครบทุกหน้าและตรวจซ้ำไปแล้ว — ไม่มีอะไรให้รออีก
        if (id) clearInterval(id);
      } catch { /* silent — รอบหน้าค่อยลองใหม่ */ }
    };

    tick();
    id = setInterval(tick, 15_000);
    return () => { cancelled = true; if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditAn, ocrRunning]);

  const records = data?.records ?? [];
  const diagnoses  = parsePipe(selectedRecord?.diagnosisList ?? null);
  const operations = parsePipe(selectedRecord?.operationList ?? null);
  const drugs      = parsePipe(selectedRecord?.drugList ?? null);
  const labs       = parsePipe(selectedRecord?.labResults ?? null);
  const xrays      = parsePipe(selectedRecord?.xrayList ?? null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500" />
            DRG Analyzer
          </h1>
          {/* Tab switcher */}
          <div className="flex gap-0.5 rounded-lg border bg-muted p-0.5 w-fit">
            <button
              onClick={() => setMainView("analyzer")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                mainView === "analyzer"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              DRG Analyzer
            </button>
            <button
              onClick={() => setMainView("evaluation")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                mainView === "evaluation"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              AI Evaluation
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/about">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
              <BookOpen className="h-3 w-3" />
              ข้อมูลระบบ AI-DRG
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={runBatchGrouper}
            disabled={batchRunning}
            className="h-8 gap-1.5 text-xs"
          >
            {batchRunning
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <ListChecks className="h-3 w-3" />}
            {batchRunning ? "กำลังประมวลผล..." : "Batch DRG"}
          </Button>
          {batchResult && !batchRunning && (
            <span className="text-xs text-muted-foreground">
              {batchResult.processed > 0
                ? `✓ ${batchResult.processed} ราย${batchResult.failed > 0 ? ` · ✗ ${batchResult.failed}` : ""}${batchResult.remaining > 0 ? ` · เหลือ ${batchResult.remaining}` : ""}`
                : batchResult.remaining === -1 ? "เกิดข้อผิดพลาด" : "ไม่มีรายการรอ"}
            </span>
          )}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {aiModels?.length ? aiModels.map(m => (
              <option key={m.id} value={m.modelId}>
                {m.name}{m.isDefault ? " ✦" : ""}
              </option>
            )) : (
              <option value={selectedModel}>{selectedModel}</option>
            )}
          </select>
        </div>
      </div>

      {/* Auto-Sync — ดึงผู้ป่วยจำหน่ายใหม่จาก HosXP อัตโนมัติ */}
      {mainView === "analyzer" && <IpdAutoSyncPanel />}

      {/* ความคืบหน้า Batch AI + แจ้งเตือนรหัสแก้หลังวิเคราะห์ */}
      {mainView === "analyzer" && (
        <IpdAiProgress onFilter={(f) => { setAnalyzedFilter(f); resetPage(); }} />
      )}

      {/* Two-panel layout / Evaluation view */}
      {mainView === "evaluation" ? (
        <AiEvaluationView />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 min-h-[calc(100vh-180px)]">
        {/* ── Left panel: record list ─────────────────────────── */}
        <Card className={cn("flex flex-col overflow-hidden", mobilePanel === "detail" && "hidden md:flex")}>
          <CardHeader className="pb-2 shrink-0 border-b space-y-2">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">รายการผู้ป่วย</CardTitle>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data?.total ?? 0} ราย
                </span>
                <button onClick={() => refetch()} className="p-1 hover:text-foreground text-muted-foreground transition-colors rounded">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="ค้นหา AN, HN, ward, รหัสโรค..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Date range */}
            <div className="flex gap-1 items-center">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                className="h-7 text-[11px] px-2 flex-1"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                className="h-7 text-[11px] px-2 flex-1"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); resetPage(); }}
                  className="text-muted-foreground hover:text-foreground text-xs px-1"
                  title="ล้างวันที่"
                >✕</button>
              )}
            </div>

            {/* Ward filter */}
            {(wardsData?.length ?? 0) > 0 && (
              <select
                value={wardFilter}
                onChange={(e) => { setWardFilter(e.target.value); resetPage(); }}
                className="w-full h-7 text-[11px] rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="">ทุกตึก/หอผู้ป่วย</option>
                {wardsData?.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            )}

            {/* Analyzed status pills */}
            <div className="flex gap-1 flex-wrap">
              {(["all", "false", "true", "uncoded", "dx-changed", "flagged"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setAnalyzedFilter(v); resetPage(); }}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded border transition-colors",
                    analyzedFilter === v
                      ? v === "dx-changed"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : v === "flagged"
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-primary bg-primary text-primary-foreground"
                      : v === "flagged"
                      ? "border-red-300 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {v === "all" ? "ทั้งหมด" : v === "true" ? "✓ วิเคราะห์แล้ว" : v === "uncoded" ? "ไม่มีรหัส" : v === "dx-changed" ? "⚠ รหัสแก้ไข" : v === "flagged" ? "⛔ รหัสผิดกฎ" : "ยังไม่วิเคราะห์"}
                </button>
              ))}
            </div>
          </CardHeader>

          {/* List */}
          <CardContent className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <BrainCircuit className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">ไม่พบรายการ</p>
                <p className="text-xs mt-1 opacity-70">ลองปรับเงื่อนไขการค้นหา</p>
              </div>
            ) : (
              records.map((r) => (
                <RecordListItem
                  key={r.id}
                  record={r}
                  selected={selectedRecord?.an === r.an}
                  onClick={() => handleSelectRecord(r)}
                  auditStatus={auditStatuses[r.an] ?? null}
                />
              ))
            )}
          </CardContent>

          {/* Pagination footer */}
          {(data?.total ?? 0) > 20 && (
            <div className="shrink-0 border-t px-3 py-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                disabled={listPage <= 1}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← ก่อนหน้า
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {listPage} / {Math.ceil((data?.total ?? 0) / 20)}
              </span>
              <button
                onClick={() => setListPage((p) => p + 1)}
                disabled={listPage >= Math.ceil((data?.total ?? 0) / 20)}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ถัดไป →
              </button>
            </div>
          )}
        </Card>

        {/* ── Right panel: analysis ──────────────────────────── */}
        <div className={cn(mobilePanel === "list" && "hidden md:block")}>
        {!selectedRecord ? (
          <Card className="flex items-center justify-center text-muted-foreground min-h-[300px] md:min-h-0">
            <div className="text-center space-y-2">
              <BrainCircuit className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-sm">เลือกผู้ป่วยจากรายการด้านซ้าย</p>
              <p className="text-xs opacity-70">เพื่อดู DC lookup และวิเคราะห์ DRG ด้วย AI</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            {/* Mobile: back button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobilePanel("list")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                กลับรายการ
              </button>
            </div>
            {/* แจ้งเตือน: รหัสโรคถูกแก้หลังวิเคราะห์ */}
            {selectedRecord.dxChangedAt && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm flex items-center gap-2 flex-wrap">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-300">
                  รหัสโรคถูกแก้ไขใน HosXP เมื่อ {new Date(selectedRecord.dxChangedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {" "}— หลังจากวิเคราะห์ AI ไปแล้ว ผลวิเคราะห์เดิมอาจไม่ตรงกับรหัสปัจจุบัน กด &quot;วิเคราะห์&quot; อีกครั้งเพื่ออัปเดต
                </span>
              </div>
            )}
            {/* Patient info bar */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold">AN {selectedRecord.an}</span>
                        {selectedRecord.hn && (
                          <span className="text-sm text-muted-foreground">HN {selectedRecord.hn}</span>
                        )}
                        {selectedRecord.sex && (
                          <Badge variant="outline" className="text-xs">
                            {selectedRecord.sex === "1" || selectedRecord.sex?.toLowerCase() === "m" ? "ชาย" : "หญิง"}
                          </Badge>
                        )}
                        {selectedRecord.ageY && (
                          <span className="text-xs text-muted-foreground">อายุ {selectedRecord.ageY} ปี</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {selectedRecord.wardName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {selectedRecord.wardName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          จำหน่าย {selectedRecord.dchdate}
                        </span>
                        {selectedRecord.los && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            LOS {selectedRecord.los} วัน
                          </span>
                        )}
                        {selectedRecord.aiAnalyzedAt && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            วิเคราะห์แล้ว {new Date(selectedRecord.aiAnalyzedAt).toLocaleDateString("th-TH")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:shrink-0">
                    <Button
                      onClick={() => {
                        const isUncoded = !selectedRecord.diagnosisList || selectedRecord.diagnosisList.trim() === "";
                        grouperMutation.mutate({
                          record: selectedRecord,
                          overrideCodes: (isUncoded && predictedCodes.length > 0) ? predictedCodes : undefined,
                        });
                      }}
                      disabled={grouperMutation.isPending || analyzeMutation.isPending || predictRunning}
                      variant="outline"
                      className="gap-1.5 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      size="sm"
                    >
                      {grouperMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังรัน Grouper...</>
                      ) : (
                        <><FileCode2 className="h-3.5 w-3.5" />คำนวณ DRG/RW</>
                      )}
                    </Button>
                    {/* Show predict button only for uncoded records */}
                    {(!selectedRecord.diagnosisList || selectedRecord.diagnosisList.trim() === "") ? (
                      <Button
                        onClick={() => predictIcdCodes(selectedRecord)}
                        disabled={predictRunning || analyzeMutation.isPending || grouperMutation.isPending}
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                        size="sm"
                      >
                        {predictRunning ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังคาดการณ์...</>
                        ) : (
                          <><Wand2 className="h-3.5 w-3.5" />คาดการณ์รหัสโรค</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => analyzeMutation.mutate(selectedRecord)}
                        disabled={analyzeMutation.isPending || grouperMutation.isPending || predictRunning}
                        className="gap-1.5"
                        size="sm"
                      >
                        {analyzeMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังวิเคราะห์...</>
                        ) : (
                          <><Sparkles className="h-3.5 w-3.5" />ตรวจสอบ Coding</>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={() => runChartAudit(selectedRecord.an)}
                      disabled={chartAuditLoading || analyzeMutation.isPending || grouperMutation.isPending || predictRunning}
                      variant="outline"
                      className="gap-1.5 border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      size="sm"
                    >
                      {chartAuditLoading ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังตรวจชาร์จ...</>
                      ) : (
                        <><ClipboardCheck className="h-3.5 w-3.5" />ตรวจชาร์จ</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grouper result */}
            {grouperResult && !grouperMutation.isPending && (
              <Card>
                <CardContent className="pt-4">
                  <GrouperResultCard result={grouperResult} />
                </CardContent>
              </Card>
            )}

            {/* DRG Compare card — shown after "คำนวณ DRG ใหม่" */}
            {compareGrouperResult && originalGrouperResult && !compareRunning && (
              <Card>
                <CardContent className="pt-4">
                  <DrgCompareCard
                    original={originalGrouperResult}
                    modified={compareGrouperResult}
                    addedCodes={[...selectedSuggestionCodes]}
                    hosxpRw={selectedRecord.hosxpRw}
                    hosxpDrg={selectedRecord.hosxpDrg}
                  />
                </CardContent>
              </Card>
            )}
            {grouperMutation.isPending && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <div className="space-y-0.5">
                      <p className="text-sm">กำลังรัน ThaiDRG Grouper...</p>
                      <p className="text-xs opacity-70">สร้างไฟล์ DBF → คำนวณ DRG/RW/AdjRW → บันทึกผล</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {grouperError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {grouperError}
              </div>
            )}
            {compareError && !compareRunning && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                คำนวณ DRG เปรียบเทียบล้มเหลว: {compareError}
              </div>
            )}

            {/* HosXP RW comparison — shown when both hosxpRw and system rw are available */}
            {selectedRecord.hosxpRw != null && selectedRecord.rw != null && (
              <Card>
                <CardContent className="pt-4">
                  <HosxpRwCompareCard record={selectedRecord} />
                </CardContent>
              </Card>
            )}

            {/* ICD Predict streaming */}
            {predictRunning && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-sm">{predictStreaming ? "กำลัง generate..." : "กำลังคาดการณ์รหัสโรค..."}</p>
                      <p className="text-xs opacity-70">ค้น RAG ICD-10 WHO 2016 · วิเคราะห์ prediag, ยา, lab</p>
                    </div>
                  </div>
                  {predictStreaming && (
                    <div className="max-h-48 overflow-y-auto rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap text-foreground/80">
                      {predictStreaming}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ICD Predict error */}
            {predictError && !predictRunning && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {predictError}
              </div>
            )}

            {/* Predicted codes result */}
            {predictedCodes.length > 0 && !predictRunning && (
              <Card>
                <CardContent className="pt-4">
                  <PredictedCodesPanel
                    codes={predictedCodes}
                    ragSources={predictRagSources}
                    prediag={selectedRecord?.prediag}
                    operationList={selectedRecord?.operationList}
                  />
                </CardContent>
              </Card>
            )}

            {/* Coding suggestions */}
            {analyzeResult?.suggestions !== undefined && !analyzeMutation.isPending && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  {analyzeResult.suggestions.length > 0 ? (
                    <>
                      <SuggestionCards
                        suggestions={analyzeResult.suggestions}
                        selectedCodes={selectedSuggestionCodes}
                        onToggle={toggleSuggestionCode}
                      />
                      {/* Re-calculate DRG button */}
                      {selectedSuggestionCodes.size > 0 && (
                        <Button
                          onClick={runCompareGrouper}
                          disabled={compareRunning}
                          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          {compareRunning
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <FileCode2 className="h-3.5 w-3.5" />}
                          {compareRunning
                            ? "กำลังคำนวณ DRG..."
                            : `คำนวณ DRG ใหม่ (เพิ่ม ${selectedSuggestionCodes.size} รหัส: ${[...selectedSuggestionCodes].join(", ")})`}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>AI ไม่พบรหัสที่ควรเพิ่มในครั้งนี้ — ตรวจสอบผลวิเคราะห์ด้านล่าง</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Diagnosis + CC/MCC */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">รหัสโรค &amp; CC/MCC</CardTitle>
                  {!analyzeResult && (
                    <p className="text-xs text-muted-foreground/60 italic">
                      กด "ตรวจสอบ Coding" เพื่อดู DC mapping และ CC/MCC
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodingRuleBanner flags={forbiddenFlags(selectedRecord)} />
                <DiagnosisSection diagnoses={diagnoses} result={analyzeResult} prediag={selectedRecord?.prediag} />
                <OperationSection operations={operations} />
                <ClinicalDetailSection drugs={drugs} labs={labs} xrays={xrays} />
              </CardContent>
            </Card>

            {/* Errors */}
            {analyzeError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {analyzeError}
              </div>
            )}

            {/* AI Analysis loading */}
            {analyzeMutation.isPending && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-sm">
                        {aiAnalysisStreaming ? "กำลัง generate..." : "กำลังตรวจสอบ coding และ CC/MCC..."}
                      </p>
                      <p className="text-xs opacity-70">ค้น RAG tdrg633 · ประมวลผล LLM</p>
                    </div>
                  </div>
                  {aiAnalysisStreaming && (
                    <div className="max-h-64 overflow-y-auto rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap text-foreground/80">
                      {aiAnalysisStreaming}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Analysis result */}
            {analyzeResult?.aiAnalysis && !analyzeMutation.isPending && (
              <Card>
                <CardContent className="pt-4">
                  <AiAnalysisResult
                    analysis={analyzeResult.aiAnalysis}
                    ragUsed={analyzeResult.rag_used}
                    ccMmcSummary={analyzeResult.cc_mcc_summary}
                    mdcInfo={analyzeResult.mdc_info}
                  />
                </CardContent>
              </Card>
            )}

            {/* Chart audit loading */}
            {chartAuditLoading && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-sm">กำลังตรวจชาร์จจาก NeoDMS...</p>
                      <p className="text-xs opacity-70">Login → ค้นหาเอกสาร → Extract text → ประเมินด้วย AI</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart audit error */}
            {chartAuditError && !chartAuditLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                ตรวจชาร์จล้มเหลว: {chartAuditError}
              </div>
            )}

            {/* อ่านเวชระเบียนได้ไม่พอ — ไม่แสดงคะแนน เพราะคะแนนที่เดาจาก metadata อันตรายกว่าไม่มีคะแนน */}
            {selectedRecord && chartAuditPending[selectedRecord.an] && !chartAuditLoading && (
              <Card>
                <CardContent className="pt-4">
                  {(() => {
                    const pend = chartAuditPending[selectedRecord.an];
                    const prog = ocrProgress[selectedRecord.an];
                    const total   = prog?.pages_total || pend.total_pages || 0;
                    const done    = prog?.pages_done ?? pend.pages_readable;
                    const needed  = pend.pages_needed || 0;
                    const running = prog ? prog.status === "running" : true;
                    const pct     = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                    const pctNeed = total > 0 && needed > 0 ? Math.min(100, (needed / total) * 100) : 0;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          {running
                            ? <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-blue-500" />
                            : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />}
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-sm font-semibold">
                              {running ? "กำลังอ่านเวชระเบียน…" : "ยังให้คะแนนไม่ได้"}
                            </p>
                            <p className="text-xs text-muted-foreground">{pend.summary}</p>
                          </div>
                        </div>

                        {total > 0 && (
                          <div className="space-y-1.5">
                            {/* แถบความคืบหน้า — ขีดประคือเกณฑ์ที่ต้องถึงจึงจะประเมินได้ */}
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              {pctNeed > 0 && pctNeed < 100 && (
                                <div
                                  className="absolute inset-y-0 w-0.5 bg-amber-500"
                                  style={{ left: `${pctNeed}%` }}
                                  title={`ต้องอ่านได้ ${needed} หน้าจึงจะประเมินได้`}
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span>
                                OCR แล้ว <strong className="text-foreground">{done}</strong>/{total} หน้า ({pct}%)
                                {needed > 0 && <> · ต้องถึง <strong className="text-amber-600 dark:text-amber-400">{needed}</strong> หน้าจึงจะประเมินได้</>}
                              </span>
                              {prog?.rate != null && prog.rate > 0 && (
                                <span>
                                  {prog.rate.toFixed(1)} หน้า/นาที
                                  {prog.etaMin != null && prog.etaMin > 0 && (
                                    <> · เหลืออีก ~{prog.etaMin < 1 ? "ไม่ถึง 1" : Math.ceil(prog.etaMin)} นาที</>
                                  )}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-blue-600 dark:text-blue-400">
                              {running
                                ? "ไม่ต้องเฝ้าหน้านี้ — ระบบจะตรวจให้เองอัตโนมัติเมื่ออ่านได้ถึงเกณฑ์"
                                : "OCR หยุดแล้ว กดปุ่ม “ตรวจชาร์จ” อีกครั้งเพื่อเริ่มอ่านหน้าที่เหลือ"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Chart audit result */}
            {selectedRecord && chartAuditResults[selectedRecord.an] && !chartAuditLoading && (
              <ChartAuditCard
                result={chartAuditResults[selectedRecord.an]}
                onRerun={() => runChartAudit(selectedRecord.an)}
                progress={ocrProgress[selectedRecord.an]}
              />
            )}
          </div>
        )}
        </div>
      </div>
      )}
    </div>
  );
}
