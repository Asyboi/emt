export type EventSeverity = 'critical' | 'warning' | 'info';
export type MapMode = 'emt-review' | 'qa-review';

export interface AmbulanceRoute {
  path: [number, number][];
  timestamps: number[];
}

export interface SimulationEvent {
  id: string;
  coordinates: [number, number];
  timestamp: number;
  label: string;
  finding: string;
  severity: EventSeverity;
  videoUrl: string;
  audioUrl: string;
  pcrLine?: string;
  confirmed?: boolean;
}
