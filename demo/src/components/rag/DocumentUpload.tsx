"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileJob {
  filename: string;
  jobId?: string;
  status: "pending" | "uploading" | "extracting" | "indexing" | "done" | "error";
  progress: number;
  totalChunks?: number;
  chunks?: number;
  error?: string;
}

async function pollJobStatus(jobId: string): Promise<{
  status: string;
  progress?: number;
  total_chunks?: number;
  chunks?: number;
  error?: string;
}> {
  const res = await fetch(`/api/rag/upload/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to poll status");
  return res.json();
}

interface DocumentUploadProps {
  defaultCollection?: string;
  onSuccess?: () => void;
}

export function DocumentUpload({ defaultCollection = "", onSuccess }: DocumentUploadProps) {
  const [collection, setCollection] = useState(defaultCollection);
  const [files, setFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploading = jobs.some((j) => j.status !== "done" && j.status !== "error");

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter((f) =>
      [".pdf", ".txt", ".docx", ".md"].some((ext) => f.name.endsWith(ext))
    );
    setFiles((prev) => [...prev, ...accepted]);
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (!collection || files.length === 0) return;

    setJobs(files.map((f) => ({ filename: f.name, status: "pending", progress: 0 })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Mark as uploading
      setJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, status: "uploading" } : j));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("collection", collection);

      try {
        const res = await fetch("/api/rag/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg = data?.detail || data?.error || "Upload failed";
          setJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, status: "error", error: errMsg } : j));
          continue;
        }

        // Background job started — poll for progress
        const jobId: string = data.job_id;
        setJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, jobId, status: "extracting" } : j));

        // Poll every 2 seconds until done or error
        let done = false;
        while (!done) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const statusData = await pollJobStatus(jobId);
            const total = statusData.total_chunks ?? 0;
            const prog = statusData.progress ?? 0;
            const pct = total > 0 ? Math.round((prog / total) * 100) : 0;

            if (statusData.status === "done") {
              setJobs((prev) =>
                prev.map((j, idx) =>
                  idx === i ? { ...j, status: "done", progress: 100, chunks: statusData.chunks } : j
                )
              );
              done = true;
            } else if (statusData.status === "error") {
              setJobs((prev) =>
                prev.map((j, idx) =>
                  idx === i ? { ...j, status: "error", error: statusData.error ?? "Processing failed" } : j
                )
              );
              done = true;
            } else {
              const uiStatus = statusData.status === "extracting" ? "extracting" : "indexing";
              setJobs((prev) =>
                prev.map((j, idx) =>
                  idx === i ? { ...j, status: uiStatus as FileJob["status"], progress: pct, totalChunks: total } : j
                )
              );
            }
          } catch {
            // polling error, retry on next tick
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Network error";
        setJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, status: "error", error: errMsg } : j));
      }
    }

    onSuccess?.();
    setFiles([]);
    setTimeout(() => setJobs([]), 4000);
  };

  const statusLabel: Record<FileJob["status"], string> = {
    pending: "Pending",
    uploading: "Uploading…",
    extracting: "Extracting text…",
    indexing: "Indexing…",
    done: "Done",
    error: "Error",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="collection">Target Collection</Label>
        <Input
          id="collection"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          placeholder="e.g., nhso, drug-list"
          disabled={isUploading}
        />
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
          isUploading && "pointer-events-none opacity-50"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOCX, MD • หลายไฟล์พร้อมกันได้</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.docx,.md"
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Pending files list */}
      {files.length > 0 && jobs.length === 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-2 py-2 px-3">
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Job progress list */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm">
                {job.status === "done" ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : job.status === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
                <span className="truncate flex-1">{job.filename}</span>
                {job.status === "done" && job.chunks !== undefined && (
                  <span className="text-xs text-muted-foreground shrink-0">{job.chunks} chunks</span>
                )}
                <Badge
                  variant={job.status === "done" ? "success" : job.status === "error" ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {statusLabel[job.status]}
                </Badge>
              </div>

              {/* Progress bar */}
              {(job.status === "indexing" || job.status === "extracting") && (
                <div className="space-y-0.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500 rounded-full"
                      style={{ width: `${job.status === "extracting" ? 15 : job.progress}%` }}
                    />
                  </div>
                  {job.status === "indexing" && job.totalChunks && (
                    <p className="text-xs text-muted-foreground">
                      {job.progress}/{job.totalChunks} chunks ({job.progress}%)
                    </p>
                  )}
                  {job.status === "extracting" && (
                    <p className="text-xs text-muted-foreground">กำลัง extract ข้อความจาก PDF…</p>
                  )}
                </div>
              )}

              {job.status === "error" && job.error && (
                <p className="text-xs text-destructive pl-6">{job.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!collection || files.length === 0 || isUploading}
        className="w-full"
      >
        {isUploading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลัง index…</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" />Upload {files.length > 0 ? `${files.length} ไฟล์` : ""}</>
        )}
      </Button>
    </div>
  );
}
