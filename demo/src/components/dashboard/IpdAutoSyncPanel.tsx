"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, History, Loader2, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SyncConfig {
  id: string;
  enabled: boolean;
  intervalMin: number;
  startHour: number;
  endHour: number;
  lastRunAt: string | null;
  lastStatus: string | null;
}

/** แถบสถานะ/ควบคุม IPD Auto-Sync — แบบเดียวกับ AutoSyncPanel ของ /opd-analyzer */
export function IpdAutoSyncPanel() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const { data: config } = useQuery<SyncConfig>({
    queryKey: ["ipd-sync-config"],
    queryFn: async () => {
      const res = await fetch("/api/ipd-sync/config");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000, // อัปเดต lastRunAt/lastStatus ทุกนาที
  });

  const updateConfig = async (patch: Partial<SyncConfig>) => {
    const res = await fetch("/api/ipd-sync/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["ipd-sync-config"] });
  };

  const syncNow = async (mode?: "backfill") => {
    setIsSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/ipd-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "backfill" ? { mode: "backfill" } : { force: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Sync failed");
      setSyncMsg(`✓ ${d.status}`);
      queryClient.invalidateQueries({ queryKey: ["ipd-records"] });
      queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      queryClient.invalidateQueries({ queryKey: ["ipd-sync-config"] });
    } catch (e) {
      setSyncMsg(`เกิดข้อผิดพลาด: ${(e as Error).message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const lastRun = config?.lastRunAt
    ? new Date(config.lastRunAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "ยังไม่เคยรัน";

  return (
    <Card className={cn(config?.enabled && "border-emerald-500/40")}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle */}
          <Button
            size="sm"
            variant={config?.enabled ? "default" : "outline"}
            className={cn("gap-1.5", config?.enabled && "bg-emerald-600 hover:bg-emerald-700")}
            onClick={() => updateConfig({ enabled: !config?.enabled })}
          >
            {config?.enabled ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
            Auto-Sync {config?.enabled ? "เปิด" : "ปิด"}
          </Button>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">ทุก</span>
            <Select value={String(config?.intervalMin ?? 15)} onValueChange={(v) => updateConfig({ intervalMin: parseInt(v) })}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[15, 30, 60, 120].map((m) => <SelectItem key={m} value={String(m)}>{m} นาที</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">ช่วง</span>
            <Select value={String(config?.startHour ?? 0)} onValueChange={(v) => updateConfig({ startHour: parseInt(v) })}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">ถึง</span>
            <Select value={String(config?.endHour ?? 24)} onValueChange={(v) => updateConfig({ endHour: parseInt(v) })}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" variant="outline" onClick={() => syncNow()} disabled={isSyncing} className="gap-1.5">
            {isSyncing
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลัง sync…</>
              : <><CloudDownload className="h-3.5 w-3.5" />Sync ทันที</>}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => syncNow("backfill")}
            disabled={isSyncing}
            className="gap-1.5"
            title="ดึงซ้ำเคสใน 120 วันที่ยังไม่มีรหัสโรค/RW — เก็บตกการลงรหัสย้อนหลัง"
          >
            <History className="h-3.5 w-3.5" />
            เก็บตกรหัสช้า
          </Button>

          <div className="text-[11px] text-muted-foreground ml-auto">
            <span>ล่าสุด: {lastRun}</span>
            {config?.lastStatus && (
              <span className={cn("ml-2", config.lastStatus.startsWith("error") ? "text-destructive" : "text-emerald-600")}>
                {config.lastStatus}
              </span>
            )}
          </div>
        </div>
        {syncMsg && (
          <p className={cn("mt-2 text-xs", syncMsg.startsWith("เกิด") ? "text-destructive" : "text-emerald-600")}>{syncMsg}</p>
        )}
      </CardContent>
    </Card>
  );
}
