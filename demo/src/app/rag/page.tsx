"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionList } from "@/components/rag/CollectionList";
import { DocumentUpload } from "@/components/rag/DocumentUpload";
import { SearchTest } from "@/components/rag/SearchTest";
import { useCollections } from "@/hooks/useRAG";
import { BookOpen, Upload, Search } from "lucide-react";

export default function RAGPage() {
  const { data: collections = [], isLoading, isError, refetch } = useCollections();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">RAG Management</h1>
        <p className="text-muted-foreground">Manage Qdrant collections and documents</p>
      </div>

      <Tabs defaultValue="collections">
        <TabsList>
          <TabsTrigger value="collections" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Collections
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Search Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-4">
          <CollectionList collections={collections} isLoading={isLoading} isError={isError} onRetry={refetch} />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload PDF, TXT, DOCX, or MD files to index in Qdrant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload onSuccess={() => refetch()} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test RAG Search</CardTitle>
              <CardDescription>Test semantic search against your collections</CardDescription>
            </CardHeader>
            <CardContent>
              <SearchTest collections={collections} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
