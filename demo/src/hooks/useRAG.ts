"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RagCollection, RagSearchResult, CollectionFile } from "@/types/rag";

async function fetchCollections(): Promise<RagCollection[]> {
  const res = await fetch("/api/rag/collections");
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json();
}

async function searchRAG(collection: string, query: string, limit = 5): Promise<RagSearchResult[]> {
  const res = await fetch("/api/rag/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection, query, limit }),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function deleteCollection(name: string) {
  const res = await fetch(`/api/rag/collections?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

export function useCollections() {
  return useQuery({
    queryKey: ["rag-collections"],
    queryFn: fetchCollections,
    retry: 1,
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rag-collections"] }),
  });
}

export function useRAGSearch() {
  return useMutation({
    mutationFn: ({ collection, query, limit }: { collection: string; query: string; limit?: number }) =>
      searchRAG(collection, query, limit),
  });
}

async function fetchCollectionFiles(collectionName: string): Promise<CollectionFile[]> {
  const res = await fetch(`/api/rag/collections/${encodeURIComponent(collectionName)}/files`);
  if (!res.ok) throw new Error("Failed to fetch files");
  return res.json();
}

async function deleteCollectionFile(collectionName: string, filename: string) {
  const res = await fetch(
    `/api/rag/collections/${encodeURIComponent(collectionName)}/files?filename=${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

export function useCollectionFiles(collectionName: string) {
  return useQuery({
    queryKey: ["collection-files", collectionName],
    queryFn: () => fetchCollectionFiles(collectionName),
    enabled: !!collectionName,
  });
}

export function useDeleteCollectionFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionName, filename }: { collectionName: string; filename: string }) =>
      deleteCollectionFile(collectionName, filename),
    onSuccess: (_data, { collectionName }) => {
      queryClient.invalidateQueries({ queryKey: ["collection-files", collectionName] });
      queryClient.invalidateQueries({ queryKey: ["rag-collections"] });
    },
  });
}
