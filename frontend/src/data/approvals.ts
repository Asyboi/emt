// Per-case approval state stored in localStorage. Survives page refresh and
// works in demo mode without a backend. Replace with a real PUT endpoint
// (`/api/cases/{id}/review`) when the backend grows persistence for
// human-review state.

const KEY_PREFIX = 'calyx-approvals:';
const keyFor = (caseId: string) => `${KEY_PREFIX}${caseId}`;

export interface ApprovalState {
  approvedSectionIds: number[];
  finalized: boolean;
  lastSavedAt: string | null;
}

const empty: ApprovalState = {
  approvedSectionIds: [],
  finalized: false,
  lastSavedAt: null,
};

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadApprovals(caseId: string): ApprovalState {
  const storage = safeStorage();
  if (!storage) return empty;
  try {
    const raw = storage.getItem(keyFor(caseId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<ApprovalState>;
    return {
      approvedSectionIds: Array.isArray(parsed.approvedSectionIds)
        ? parsed.approvedSectionIds.filter((n): n is number => typeof n === 'number')
        : [],
      finalized: parsed.finalized === true,
      lastSavedAt: typeof parsed.lastSavedAt === 'string' ? parsed.lastSavedAt : null,
    };
  } catch {
    return empty;
  }
}

export function saveApprovals(
  caseId: string,
  patch: Partial<Omit<ApprovalState, 'lastSavedAt'>>,
): ApprovalState {
  const current = loadApprovals(caseId);
  const next: ApprovalState = {
    ...current,
    ...patch,
    lastSavedAt: new Date().toISOString(),
  };
  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(keyFor(caseId), JSON.stringify(next));
    } catch {
      // localStorage full or disabled — silently drop. UI state still works
      // for the current session.
    }
  }
  return next;
}

export function isFinalizedLocally(caseId: string): boolean {
  return loadApprovals(caseId).finalized;
}
