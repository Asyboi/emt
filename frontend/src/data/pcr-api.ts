import type { PCRDraft } from '../types/backend';
import { API_BASE } from './api';

// Mirror of the backend placeholder body (see backend/app/api/pcr_draft.py:63).
// The em-dash (U+2014) must match exactly — keep this constant to detect the
// "still generating" state without hard-coding the string in multiple places.
export const PCR_DRAFT_PLACEHOLDER = '*Generating PCR draft — please wait...*';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function createPcrDraft(caseId: string): Promise<PCRDraft> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`, {
    method: 'POST',
  });
  return readJson<PCRDraft>(res);
}

export async function getPcrDraft(caseId: string): Promise<PCRDraft> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/pcr-draft`);
  return readJson<PCRDraft>(res);
}

export async function confirmPcrDraft(
  caseId: string,
  editedMarkdown: string,
  confirmedBy = 'emt',
): Promise<PCRDraft> {
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
