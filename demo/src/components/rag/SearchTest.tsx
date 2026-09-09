"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { useRAGSearch } from "@/hooks/useRAG";
import { RagCollection, RagSearchResult } from "@/types/rag";
import { Badge } from "@/components/ui/badge";

interface SearchTestProps {
  collections: RagCollection[];
}

export function SearchTest({ collections }: SearchTestProps) {
  const [collection, setCollection] = useState("");
  const [query, setQuery] = useState("");
  const { mutate: search, data: results, isPending } = useRAGSearch();

  const handleSearch = () => {
    if (!collection || !query.trim()) return;
    search({ collection, query, limit: 5 });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="space-y-1 w-48">
          <Label>Collection</Label>
          <Select value={collection} onValueChange={setCollection}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {collections.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label>Query</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search query..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!collection || !query.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((result: RagSearchResult) => (
            <Card key={result.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">Score: {result.score.toFixed(4)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{result.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
      )}
    </div>
  );
}
