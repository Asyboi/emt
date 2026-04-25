import type { IncidentReport, IncidentSummary } from '../types';
import { buildMockReport, mockIncidentList } from '../mock/mock_data';

// `local` reads from `src/mock/mock_data.ts`. `remote` is a stub that will
// eventually call the FastAPI backend (cases + SSE pipeline). The mode is
// resolved per call rather than at module load so the URL toggle takes effect
// without a hot reload.
export type DataSourceMode = 'local' | 'remote';

const DEFAULT_MODE: DataSourceMode = 'local';

function urlOverride(): DataSourceMode | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has('local')) return 'local';
  if (params.has('remote')) return 'remote';
  return null;
}

function envMode(): DataSourceMode | null {
  const raw = import.meta.env.VITE_DATA_SOURCE;
  if (raw === 'local' || raw === 'remote') return raw;
  return null;
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
    throw new Error('Remote data source not implemented yet');
  },
  async getIncident(_id: string) {
    throw new Error('Remote data source not implemented yet');
  },
};

export function getDataSource(): DataSource {
  return resolveMode() === 'remote' ? remoteSource : localSource;
}
