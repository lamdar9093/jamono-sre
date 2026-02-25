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