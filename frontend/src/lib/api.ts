import type { Case, PipelineProgress, QICaseReview } from "@/types/schemas";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${BASE}/api${path}`;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function getCases(): Promise<Case[]> {
  return getJSON<Case[]>("/cases");
}

export function getCase(id: string): Promise<Case> {
  return getJSON<Case>(`/cases/${id}`);
}

export function getPCR(id: string): Promise<{ content: string }> {
  return getJSON<{ content: string }>(`/cases/${id}/pcr`);
}

export function getReview(id: string): Promise<QICaseReview> {
  return getJSON<QICaseReview>(`/cases/${id}/review`);
}

export async function deleteReview(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/cases/${id}/review`), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /cases/${id}/review failed: ${res.status}`);
  }
}

export function getVideoUrl(id: string): string {
  return apiUrl(`/cases/${id}/video`);
}

export interface StreamHandlers {
  onProgress: (progress: PipelineProgress) => void;
  onComplete: (review: QICaseReview) => void;
  onError: (message: string) => void;
}

export interface StreamOptions {
  demo?: boolean;
}

export function streamCase(
  id: string,
  handlers: StreamHandlers,
  options: StreamOptions = {},
): EventSource {
  const qs = options.demo ? "?demo=1" : "";
  const source = new EventSource(apiUrl(`/cases/${id}/stream${qs}`));

  source.addEventListener("progress", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as PipelineProgress;
      handlers.onProgress(data);
    } catch (err) {
      handlers.onError(`Failed to parse progress event: ${(err as Error).message}`);
    }
  });

  source.addEventListener("complete", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as {
        type: string;
        review: QICaseReview;
      };
      handlers.onComplete(data.review);
    } catch (err) {
      handlers.onError(`Failed to parse complete event: ${(err as Error).message}`);
    } finally {
      source.close();
    }
  });

  source.addEventListener("error", (event) => {
    const data = (event as MessageEvent).data;
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data) as { message?: string };
        handlers.onError(parsed.message ?? "Pipeline error");
      } catch {
        handlers.onError("Pipeline error");
      }
    } else {
      handlers.onError("Stream connection error");
    }
    source.close();
  });

  return source;
}
