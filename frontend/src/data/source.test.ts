import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getDataSource } from './source';
import type { Case, QICaseReview } from '../types/backend';

const reviewFixture: QICaseReview = JSON.parse(
  // Inline-load the fixture via fs so the test file can stay self-contained.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('node:fs').readFileSync(
    require('node:path').resolve(
      __dirname,
      '..',
      '..',
      '..',
      'fixtures',
      'sample_qi_review.json',
    ),
    'utf-8',
  ),
);

const caseFixture: Case = {
  case_id: 'case_01',
  incident_type: 'cardiac_arrest',
  incident_date: '2026-04-24T14:00:00Z',
  pcr_path: 'cases/case_01/pcr.md',
  video_path: 'cases/case_01/video.mp4',
  audio_path: 'cases/case_01/audio.mp3',
  cad_path: null,
  metadata: {},
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('remoteSource', () => {
  beforeEach(() => {
    // Force ?remote even when the test runs from / (jsdom default URL).
    window.history.replaceState(null, '', '/?remote');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('listIncidents fetches /api/cases and adapts each Case to a summary', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([caseFixture]),
    );

    const summaries = await getDataSource().listIncidents();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/cases'));
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe('case_01');
    expect(summaries[0].date).toBe('2026-04-24');
    expect(summaries[0].status).toBe('draft');
  });

  test('getIncident fetches /api/cases/{id}/review and runs it through adaptReview', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(reviewFixture),
    );

    const report = await getDataSource().getIncident('case_01');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cases/case_01/review'),
    );
    expect(report.id).toBe('case_01');
    expect(report.sections).toHaveLength(9);
    expect(report.pcr.unit).toBe('Medic 51');
  });

  test('getIncident throws a clear error when the review is missing (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );

    await expect(getDataSource().getIncident('case_99')).rejects.toThrow(/case_99/);
  });
});
