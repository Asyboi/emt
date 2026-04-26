import type { PipelineStatus } from '../../../types/backend';

// The status vocabulary maps 1:1 to the backend's PipelineStatus so the
// pipeline visualization can consume `useProcessingStream` state directly.
export type AgentVizStatus = PipelineStatus;

// Color-coded model indicators. The pipeline tells a routing story: each
// stage uses the model best suited to its task. Pills are the at-a-glance
// vocabulary for that.
export type ModelPillKind =
  | 'pydantic'
  | 'rule'
  | 'fixture'
  | 'haiku'
  | 'sonnet'
  | 'gemini'
  | 'scribe';

export interface ModelPillSpec {
  kind: ModelPillKind;
  count?: number;
  suffix?: string;
}
