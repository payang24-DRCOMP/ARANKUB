"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";

interface AiStats {
  total: number;
  coded: number;
  analyzed: number;
  queue: number;
  dxChanged: number;
  uncoded: number;
}

/**
 * แถบความคืบหน้า Batch AI ของ IPD — แบบเดียวกับหน้า /opd-analyzer
 * แสดง วิเคราะห์แล้ว/มีรหัสแล้ว + คิวรอ + เคสรหัสแก้หลังวิเคราะห์ (กดเพื่อกรอง)
 */
export function IpdAiProgress({ onFilter }: { onFilter?: (filter: string) => void }) {
  const { data: stats } = useQuery<AiStats>({
    queryKey: ["ipd-ai-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ipd-records/ai-stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000, // เห็นความคืบหน้า batch AI สดๆ
  });

  if (!stats || stats.coded === 0) return null;
  const pct = Math.min(100, (stats.analyzed / stats.coded) * 100);

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          ความคืบหน้า AI: วิเคราะห์แล้ว {stats.analyzed.toLocaleString()} / {stats.coded.toLocaleString()} เคสที่มีรหัสโรค
          ({pct.toFixed(0)}%)
          <span className="text-muted-foreground font-normal">
            · คิวรอ {stats.queue.toLocaleString()} · รอลงรหัส {stats.uncoded.toLocaleString()}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {stats.dxChanged > 0 && (
            <button
              onClick={() => onFilter?.("dx-changed")}
              className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:opacity-80"
              title="รหัสโรคถูกแก้ใน HosXP หลังวิเคราะห์ — กดเพื่อดูรายการแล้ววิเคราะห์ใหม่"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              รหัสแก้หลังวิเคราะห์ {stats.dxChanged} เคส »
            </button>
          )}
          <button
            onClick={() => onFilter?.("false")}
            className="text-[11px] text-violet-600 underline underline-offset-2 hover:opacity-80"
          >
            ดูคิวรอวิเคราะห์ »
          </button>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-violet-500/15 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
