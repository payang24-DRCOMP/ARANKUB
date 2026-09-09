export interface RagCollection {
  name: string;
  vectorsCount: number;
  pointsCount: number;
  status: "green" | "yellow" | "red";
  createdAt?: string;
}

export interface RagDocument {
  id: string;
  filename: string;
  collection: string;
  chunkCount: number;
  uploadedAt: Date;
}

export interface CollectionFile {
  filename: string;
  chunks: number;
}

export interface RagSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  content: string;
}

export interface RagSearchRequest {
  collection: string;
  query: string;
  limit?: number;
}

export interface UploadProgress {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  chunks?: number;
}
