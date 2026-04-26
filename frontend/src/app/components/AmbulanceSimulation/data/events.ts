import type { SimulationEvent } from '../types';

export const SIMULATION_EVENTS: SimulationEvent[] = [
  {
    id: 'evt_onscene',
    coordinates: [-73.9978, 40.7148],
    timestamp: 0,
    label: 'Unit On Scene',
    finding:
      'PCR documents arrival at 00:19:10 — CAD confirms 00:21:37. 2m27s discrepancy.',
    severity: 'critical',
    videoUrl: '/demo/clip_onscene.mp4',
    audioUrl: '/demo/radio_onscene.mp3',
    pcrLine: 'Unit Arrived On Scene: 01/01/2023 00:19:10',
    confirmed: false,
  },
  {
    id: 'evt_aed',
    coordinates: [-73.9978, 40.7152],
    timestamp: 160,
    label: 'AED Applied',
    finding:
      'PCR says AED applied at 00:21:00 — video shows 00:24:15. 3m15s discrepancy.',
    severity: 'critical',
    videoUrl: '/demo/clip_aed.mp4',
    audioUrl: '/demo/radio_aed.mp3',
    pcrLine: '00:23 AED/cardiac monitor applied.',
    confirmed: false,
  },
  {
    id: 'evt_epi',
    coordinates: [-73.9978, 40.7156],
    timestamp: 360,
    label: 'Epinephrine Administered',
    finding:
      'PCR documents epi at 00:23:00 — radio audio confirms 00:28:44. 5m44s discrepancy.',
    severity: 'critical',
    videoUrl: '/demo/clip_epi.mp4',
    audioUrl: '/demo/radio_epi.mp3',
    pcrLine: '00:28 Epinephrine 1 mg administered IO.',
    confirmed: false,
  },
  {
    id: 'evt_rosc',
    coordinates: [-73.9978, 40.716],
    timestamp: 720,
    label: 'ROSC Achieved',
    finding:
      'ROSC documented at 00:35:00 — no post-ROSC 12-lead documented. ACLS protocol violation.',
    severity: 'warning',
    videoUrl: '/demo/clip_rosc.mp4',
    audioUrl: '/demo/radio_rosc.mp3',
    pcrLine: '00:39 Pulse check performed. Carotid pulse present. ROSC achieved.',
    confirmed: false,
  },
  {
    id: 'evt_hospital',
    coordinates: [-73.9756, 40.7394],
    timestamp: 1200,
    label: 'Hospital Arrival',
    finding:
      'Unit arrived Bellevue Hospital ED at 00:47:46. Disposition code 82 — ALS transport.',
    severity: 'info',
    videoUrl: '/demo/clip_hospital.mp4',
    audioUrl: '/demo/radio_hospital.mp3',
    pcrLine: 'Arrived At Hospital: 01/01/2023 00:47:46',
    confirmed: false,
  },
];
