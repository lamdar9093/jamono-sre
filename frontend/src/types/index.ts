// Les états possibles d'un pod Kubernetes
export type PodHealth = "HEALTHY" | "UNHEALTHY" | "UNKNOWN";

// Un pod tel que retourné par l'API
export interface Pod {
  pod_name: string;
  health_status: PodHealth;
  restarts: number;
  diagnostic: string;
  internal_phase: string;
}

// La remédiation proposée par l'agent
export interface Remediation {
  incident_detected: boolean;
  severity: "low" | "medium" | "high";
  component: string;
  action_type: "PATCH_RESOURCES" | "PATCH_COMMAND" | "RESTART" | "NONE";
  suggested_change: {
    current: string;
    new: string;
  };
  justification: string;
  requires_approval: boolean;
}

// La réponse complète de ton API /chat
export interface ApiResponse {
  status: string;
  thread_id: string;
  response: string;
  remediation: Remediation | null;
  has_action: boolean;
}

export type IncidentStatus = "watching" | "open" | "in_progress" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentSource = "auto" | "manual" | "watch";
export type IncidentEnvironment = "prod" | "staging" | "dev";

export interface Incident {
  id: number;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource;
  environment: IncidentEnvironment;
  linked_pod: string | null;
  assigned_to: string | null;
  created_by: string;
  slack_channel: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  watch_until: string | null;
  mttr_seconds: number | null;
}

export interface TimelineEntry {
  id: number;
  incident_id: number;
  timestamp: string;
  author: string;
  action: string;
  detail: string;
}

export interface MttrStats {
  total: number;
  resolved: number;
  avg_mttr_seconds: number;
  min_mttr_seconds: number;
  max_mttr_seconds: number;
}