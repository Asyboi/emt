import type { PCRDraft } from '../types/backend';
import { buildMockPcrDraft, mockSavedPcrs, resolveMockPcrDraft } from '../mock/mock_pcr';
import { countUnconfirmed } from '../lib/pcr-highlight';
import { API_BASE } from './api';
import { getDataSource } from './source';

// Mirror of the backend placeholder body (see backend/app/api/pcr_draft.py:63).
// The em-dash (U+2014) must match exactly — keep this constant to detect the
// "still generating" state without hard-coding the string in multiple places.
export const PCR_DRAFT_PLACEHOLDER = '*Generating PCR draft — please wait...*';

const LOCAL_DELAY_MS = 60;

function isLocal(): boolean {
  return getDataSource().mode === 'local';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function createPcrDraft(caseId: string): Promise<PCRDraft> {
  if (isLocal()) {
    await delay(LOCAL_DELAY_MS);
    return buildMockPcrDraft(caseId);
  }
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`, {
    method: 'POST',
  });
  return readJson<PCRDraft>(res);
}

export async function getPcrDraft(caseId: string): Promise<PCRDraft> {
  if (isLocal()) {
    await delay(LOCAL_DELAY_MS);
    return resolveMockPcrDraft(caseId);
  }
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`);
  return readJson<PCRDraft>(res);
}

export async function confirmPcrDraft(
  caseId: string,
  editedMarkdown: string,
  confirmedBy = 'emt',
): Promise<PCRDraft> {
  if (isLocal()) {
    await delay(LOCAL_DELAY_MS);
    const base = resolveMockPcrDraft(caseId);
    return {
      ...base,
      draft_markdown: editedMarkdown,
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      emt_edits_made: editedMarkdown !== base.draft_markdown,
      unconfirmed_count: countUnconfirmed(editedMarkdown),
    };
  }
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      edited_markdown: editedMarkdown,
      confirmed_by: confirmedBy,
    }),
  });
  return readJson<PCRDraft>(res);
}

export async function listSavedPcrs(): Promise<PCRDraft[]> {
  if (isLocal()) {
    await delay(LOCAL_DELAY_MS);
    return mockSavedPcrs;
  }
  const res = await fetch(`${API_BASE}/api/pcr-drafts`);
  return readJson<PCRDraft[]>(res);
}

export function isPcrGenerating(draft: PCRDraft): boolean {
  return (
    draft.draft_markdown === PCR_DRAFT_PLACEHOLDER &&
    draft.error === null &&
    draft.total_event_count === 0
  );
}
