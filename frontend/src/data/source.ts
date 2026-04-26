import type { IncidentReport, IncidentSummary } from '../types';
import { buildMockReport, mockIncidentList } from '../mock/mock_data';
import type { Case, QICaseReview } from '../types/backend';
import { adaptCaseToSummary, adaptReview } from './adapters';
import { API_BASE } from './api';

// `local` reads from src/mock/mock_data.ts + src/mock/mock_pcr.ts and
// synthesizes the pipeline in src/data/sse.ts (no backend needed).
// `remote` calls the FastAPI backend.
//
// The mode is driven by VITE_LOCAL_MODE in frontend/.env.local:
//   VITE_LOCAL_MODE=true   → local
//   VITE_LOCAL_MODE=false  → remote (default if the variable is unset)
//
// A URL query (?local / ?remote) wins over the env var so you can flip a
// single tab without restarting Vite. The mode is resolved per call so that
// override takes effect immediately.
export type DataSourceMode = 'local' | 'remote';

const DEFAULT_MODE: DataSourceMode = 'remote';

function urlOverride(): DataSourceMode | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has('local')) return 'local';
  if (params.has('remote')) return 'remote';
  return null;
}

function envMode(): DataSourceMode | null {
  const raw = import.meta.env.VITE_LOCAL_MODE;
  if (raw === undefined || raw === '') return null;
  // Accept "true"/"1" (case-insensitive) as local; anything else (including
  // "false"/"0") forces remote. Booleans flow through .env as strings.
  const truthy = String(raw).trim().toLowerCase();
  if (truthy === 'true' || truthy === '1') return 'local';
  return 'remote';
}

export function resolveMode(): DataSourceMode {
  return urlOverride() ?? envMode() ?? DEFAULT_MODE;
}

export interface DataSource {
  mode: DataSourceMode;
  listIncidents(): Promise<IncidentSummary[]>;
  getIncident(id: string): Promise<IncidentReport>;
}

const localSource: DataSource = {
  mode: 'local',
  async listIncidents() {
    return mockIncidentList;
  },
  async getIncident(id: string) {
    return buildMockReport(id);
  },
};

const remoteSource: DataSource = {
  mode: 'remote',
  async listIncidents() {
    const res = await fetch(`${API_BASE}/api/cases`);
    if (!res.ok) throw new Error(`Failed to list cases (${res.status})`);
    const cases: Case[] = await res.json();
    return cases.map((c) => adaptCaseToSummary(c, false));
  },
  async getIncident(id: string) {
    const res = await fetch(`${API_BASE}/api/cases/${id}/review`);
    if (!res.ok) throw new Error(`Review not found for ${id}`);
    const review: QICaseReview = await res.json();
    return adaptReview(review);
  },
};

export function getDataSource(): DataSource {
  return resolveMode() === 'remote' ? remoteSource : localSource;
}
