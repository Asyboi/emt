import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { adaptCaseToSummary, adaptReview } from './adapters';
import type { CADRecord, Case, QICaseReview } from '../types/backend';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'sample_qi_review.json',
);

function loadFixture(): QICaseReview {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as QICaseReview;
}

describe('adaptReview', () => {
  test('maps top-level identity, date/time, crew, and lifecycle status', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    expect(out.id).toBe('case_01');
    expect(out.date).toBe('2026-04-24');
    expect(out.time).toBe('14:00');
    // "Medic 51 / P-001, P-002"
    expect(out.crew).toBe('Medic 51 / P-001, P-002');
    expect(out.status).toBe('draft'); // human_reviewed === false
  });

  test('produces 9 report sections with required shape, no undefined values', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    expect(out.sections).toHaveLength(9);
    out.sections.forEach((s, idx) => {
      expect(s.id).toBe(idx + 1);
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.status).toBe('draft');
      expect(typeof s.content).toBe('string');
      expect(typeof s.preview).toBe('string');
      expect(s.preview.length).toBeLessThanOrEqual(200);
      expect(Array.isArray(s.citations)).toBe(true);
      expect(s.citations).toHaveLength(0);
    });

    expect(out.sections[0].title).toBe('INCIDENT SUMMARY');
    expect(out.sections[0].content).toContain('Male patient');
    expect(out.sections[1].title).toBe('TIMELINE RECONSTRUCTION');
    expect(out.sections[2].title).toBe('PCR DOCUMENTATION CHECK');
    expect(out.sections[2].content).toContain('Completeness:');
    expect(out.sections[3].title).toBe('PROTOCOL COMPLIANCE REVIEW');
    expect(out.sections[4].title).toBe('KEY CLINICAL DECISIONS');
    expect(out.sections[5].title).toBe('COMMUNICATION / SCENE MANAGEMENT');
    expect(out.sections[6].title).toBe('STRENGTHS');
    expect(out.sections[7].title).toBe('AREAS FOR IMPROVEMENT');
    expect(out.sections[8].title).toBe('RECOMMENDED FOLLOW-UP');
  });

  test('strengths section only contains items where status is met', () => {
    const review = loadFixture();
    const out = adaptReview(review);
    const strengths = out.sections[6].content;

    // ca_01 (met) should appear; ca_05 (not_met) should not.
    expect(strengths).toContain('Arrival to patient contact within 60 seconds');
    expect(strengths).not.toContain('Advanced airway placed within 5 minutes');
  });

  test('areas-for-improvement section only contains concern + critical findings', () => {
    const review = loadFixture();
    const out = adaptReview(review);
    const areas = out.sections[7].content;

    // critical fnd_01 + concern fnd_02/fnd_03 should appear.
    expect(areas).toContain('First epinephrine dose');
    expect(areas).toContain('Second IV access attempt');
    // info-severity fnd_04 should NOT appear here.
    expect(areas).not.toContain('Advanced airway placement deferred');
  });

  test('recommendations section is grouped by audience with priority prefix', () => {
    const review = loadFixture();
    const out = adaptReview(review);
    const recs = out.sections[8].content;

    expect(recs).toContain('[required]');
    expect(recs).toContain('[suggested]');
    expect(recs).toContain('[informational]');
  });

  test('maps timeline entries to TimelineEvent[] with MM:SS time and category', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    expect(out.timelineEvents).toHaveLength(3);

    // 120s → 02:00 ; arrival → 'cad' (per ARRIVAL/TRANSPORT_DECISION rule)
    expect(out.timelineEvents[0]).toEqual({
      time: '02:00',
      label: 'EMS arrives on scene; patient pulseless, apneic, bystander CPR in progress.',
      category: 'cad',
    });

    // 240s → 04:00 ; defibrillation → not arrival, source_events[0] is pcr → 'pcr'
    expect(out.timelineEvents[1].time).toBe('04:00');
    expect(out.timelineEvents[1].category).toBe('pcr');

    // 480s → 08:00 ; patient_response, source_events[0] is pcr → 'pcr'
    expect(out.timelineEvents[2].time).toBe('08:00');
    expect(out.timelineEvents[2].category).toBe('pcr');
  });

  test('derives pcr metadata from review fields', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    expect(out.pcr.incidentNumber).toBe('case_01');
    expect(out.pcr.unit).toBe('Medic 51');
    expect(out.pcr.crew).toBe('P-001, P-002');
    expect(out.pcr.chiefComplaint).toBe('Witnessed cardiac arrest');
  });

  test('returns empty cadLog when review has no cad_record', () => {
    const review = loadFixture();
    expect(review.cad_record).toBeFalsy();
    const out = adaptReview(review);
    expect(out.cadLog).toEqual([]);
  });

  test('synthesizes cadLog from cad_record datetimes when present', () => {
    const review = loadFixture();
    const cad: CADRecord = {
      cad_incident_id: 'CAD-99',
      incident_datetime: '2026-04-24T14:00:00Z',
      initial_call_type: 'CARDIAC ARREST',
      initial_severity_level_code: 1,
      final_call_type: 'CARDIAC ARREST',
      final_severity_level_code: 1,
      first_assignment_datetime: '2026-04-24T14:00:30Z',
      first_activation_datetime: '2026-04-24T14:00:45Z',
      first_on_scene_datetime: '2026-04-24T14:02:00Z',
      first_to_hosp_datetime: '2026-04-24T14:13:00Z',
      first_hosp_arrival_datetime: '2026-04-24T14:21:00Z',
      incident_close_datetime: '2026-04-24T14:35:00Z',
      dispatch_response_seconds: 30,
      incident_response_seconds: 120,
      incident_travel_seconds: 480,
      incident_disposition_code: '82',
      borough: null,
      zipcode: null,
      incident_location: null,
      protocol_families: [],
    };
    const out = adaptReview({ ...review, cad_record: cad });

    expect(out.cadLog).toHaveLength(7);
    expect(out.cadLog[0].message).toBe('INCIDENT CREATED — CARDIAC ARREST');
    expect(out.cadLog[1].message).toBe('UNIT ASSIGNED');
    expect(out.cadLog[2].message).toBe('UNIT ACTIVATED');
    expect(out.cadLog[3].message).toBe('ON SCENE');
    expect(out.cadLog[4].message).toBe('EN ROUTE TO HOSPITAL');
    expect(out.cadLog[5].message).toBe('ARRIVED AT HOSPITAL');
    expect(out.cadLog[6].message).toBe('INCIDENT CLOSED');
    // time format HH:MM:SS
    expect(out.cadLog[0].time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test('omits transport/hospital cad rows when those datetimes are null', () => {
    const review = loadFixture();
    const cad: CADRecord = {
      cad_incident_id: 'CAD-100',
      incident_datetime: '2026-04-24T14:00:00Z',
      initial_call_type: 'CHEST PAIN',
      initial_severity_level_code: 3,
      final_call_type: 'CHEST PAIN',
      final_severity_level_code: 3,
      first_assignment_datetime: '2026-04-24T14:00:30Z',
      first_activation_datetime: '2026-04-24T14:00:45Z',
      first_on_scene_datetime: '2026-04-24T14:02:00Z',
      first_to_hosp_datetime: null,
      first_hosp_arrival_datetime: null,
      incident_close_datetime: '2026-04-24T14:35:00Z',
      dispatch_response_seconds: null,
      incident_response_seconds: null,
      incident_travel_seconds: null,
      incident_disposition_code: '82',
      borough: null,
      zipcode: null,
      incident_location: null,
      protocol_families: [],
    };
    const out = adaptReview({ ...review, cad_record: cad });

    expect(out.cadLog).toHaveLength(5);
    expect(out.cadLog.map((e) => e.message)).toEqual([
      'INCIDENT CREATED — CHEST PAIN',
      'UNIT ASSIGNED',
      'UNIT ACTIVATED',
      'ON SCENE',
      'INCIDENT CLOSED',
    ]);
  });

  test('produces pipeline scaffold with findings mapped from review.findings', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    expect(out.pipeline.elapsedSeconds).toBe(0);
    expect(out.pipeline.progressPct).toBe(100);
    expect(out.pipeline.agentTiles).toEqual([]);
    expect(out.pipeline.audioLogs).toEqual([]);

    expect(out.pipeline.findings).toHaveLength(4);
    // info severity → success; concern/critical → warning
    const infoFinding = out.pipeline.findings.find((f) =>
      f.message.startsWith('Advanced airway placement deferred'),
    );
    expect(infoFinding?.type).toBe('success');
    const criticalFinding = out.pipeline.findings.find((f) =>
      f.message.startsWith('First epinephrine dose'),
    );
    expect(criticalFinding?.type).toBe('warning');
    // sources is the joined evidence_event_ids
    expect(criticalFinding?.sources).toContain('evt_b2c4d5e6-vid-defib1');
  });

  test('output has no undefined values in any required IncidentReport field', () => {
    const review = loadFixture();
    const out = adaptReview(review);

    const requiredKeys: (keyof typeof out)[] = [
      'id',
      'date',
      'time',
      'crew',
      'status',
      'sections',
      'timelineEvents',
      'pcr',
      'cadLog',
      'pipeline',
    ];
    requiredKeys.forEach((k) => expect(out[k]).not.toBeUndefined());

    // Spot-check nested required keys.
    (['incidentNumber', 'unit', 'crew', 'chiefComplaint'] as const).forEach((k) =>
      expect(out.pcr[k]).not.toBeUndefined(),
    );
    (['elapsedSeconds', 'progressPct', 'agentTiles', 'findings', 'audioLogs'] as const).forEach(
      (k) => expect(out.pipeline[k]).not.toBeUndefined(),
    );
  });
});

describe('adaptCaseToSummary', () => {
  const baseCase: Case = {
    case_id: 'case_07',
    incident_type: 'cardiac_arrest',
    incident_date: '2026-04-12T14:32:00Z',
    pcr_path: 'cases/case_07/pcr.md',
    video_path: 'cases/case_07/video.mp4',
    audio_path: 'cases/case_07/audio.mp3',
    cad_path: null,
    metadata: {},
  };

  test('extracts YYYY-MM-DD, uses case_id for crew, marks finalized when review exists', () => {
    const out = adaptCaseToSummary(baseCase, true);
    expect(out.id).toBe('case_07');
    expect(out.date).toBe('2026-04-12');
    expect(out.crew).toBe('case_07');
    expect(out.status).toBe('finalized');
  });

  test('marks status as draft when no review cached', () => {
    const out = adaptCaseToSummary(baseCase, false);
    expect(out.status).toBe('draft');
  });
});
