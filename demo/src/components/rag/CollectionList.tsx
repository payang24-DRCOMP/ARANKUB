"use client";

import { useState } from "react";
import { RagCollection } from "@/types/rag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trash2, Database, Loader2, WifiOff, RefreshCw,
  FileText, ChevronDown, ChevronRight,
} from "lucide-react";
import { useDeleteCollection, useCollectionFiles, useDeleteCollectionFile } from "@/hooks/useRAG";

interface CollectionListProps {
  collections: RagCollection[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function CollectionCard({ collection }: { collection: RagCollection }) {
  const [expanded, setExpanded] = useState(false);
  const deleteCollection = useDeleteCollection();
  const deleteFile = useDeleteCollectionFile();
  const { data: files, isLoading: filesLoading } = useCollectionFiles(
    expanded ? collection.name : ""
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-start justify-between gap-2">
          <button
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors text-left"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            {collection.name}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
            onClick={() => deleteCollection.mutate(collection.name)}
            disabled={deleteCollection.isPending}
            title="ลบ collection ทั้งหมด"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Points</span>
          <span className="font-medium text-foreground">{collection.pointsCount.toLocaleString()}</span>
        </div>
        <Badge
          variant={collection.status === "green" ? "success" : collection.status === "yellow" ? "warning" : "destructive"}
          className="w-full justify-center"
        >
          {collection.status}
        </Badge>

        {/* File list (expandable) */}
        {expanded && (
          <div className="mt-3 space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">ไฟล์ในคอลเลกชัน</p>
            {filesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังโหลด...
              </div>
            ) : files && files.length > 0 ? (
              files.map((f) => (
                <div
                  key={f.filename}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="text-xs truncate" title={f.filename}>{f.filename}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">({f.chunks})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() =>
                      deleteFile.mutate({ collectionName: collection.name, filename: f.filename })
                    }
                    disabled={deleteFile.isPending}
                    title={`ลบ ${f.filename}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-1">ไม่มีไฟล์</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CollectionList({ collections, isLoading, isError, onRetry }: CollectionListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
        <WifiOff className="h-12 w-12 opacity-30" />
        <div className="text-center space-y-1">
          <p className="text-base font-medium text-foreground">ไม่สามารถเชื่อมต่อ Qdrant ได้</p>
          <p className="text-sm">ข้อมูล collections ของคุณยังอยู่ครบ — Qdrant ต้องเปิดใช้งานก่อน</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            ไปที่ Dashboard หรือ Settings แล้วกด <strong>Start</strong> ที่ Qdrant
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
            <RefreshCw className="h-3.5 w-3.5" />
            ลองใหม่
          </Button>
        )}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No collections</p>
        <p className="text-sm">Upload documents to create a collection</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <CollectionCard key={collection.name} collection={collection} />
      ))}
    </div>
  );
}
