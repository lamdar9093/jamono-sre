import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";
import Modal from "../components/Modal";

interface PodReport {
  pod_name: string;
  health_status: string;
  restarts: number;
  diagnostic: string | null;
  internal_phase: string;
  severity: string;
  has_incident: boolean;
  incident_id: number | null;
}

interface TriageResult {
  namespace: string;
  total: number;
  unhealthy: number;
  healthy: number;
  pods: PodReport[];
}

const SEV_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: "#C13434", bg: "rgba(193,52,52,0.06)", border: "rgba(193,52,52,0.15)", label: "Critical" },
  high:     { color: "#D85A30", bg: "rgba(216,90,48,0.06)", border: "rgba(216,90,48,0.15)", label: "High" },
  medium:   { color: "#B87514", bg: "rgba(184,117,20,0.06)", border: "rgba(184,117,20,0.15)", label: "Medium" },
  low:      { color: "#2D8B5F", bg: "rgba(45,139,95,0.06)", border: "rgba(45,139,95,0.15)", label: "Low" },
  healthy:  { color: "#2D8B5F", bg: "rgba(45,139,95,0.04)", border: "rgba(45,139,95,0.1)", label: "Healthy" },
};

export default function ScanTriage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<Record<string, boolean>>({ incident: true, slack: false, jira: false });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Set<string>>(new Set());
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [activeIntegrations, setActiveIntegrations] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "unhealthy" | "healthy">("all");
  const [createdResults, setCreatedResults] = useState<{ pod: string; incident_id: number; actions: string[] }[]>([]);
  const [notifyPod, setNotifyPod] = useState<PodReport | null>(null);

  useEffect(() => {
    if (open) {
      runScan();
      axios.get(`${API_URL}/integrations`).then(r => {
        const active = (r.data.integrations ?? []).filter((i: any) => i.is_active).map((i: any) => i.type);
        setActiveIntegrations(active);
      }).catch(() => {});
    }
  }, [open]);

  const runScan = async () => {
    setScanning(true);
    setResult(null);
    setSelected(new Set());
    setCreated(new Set());
    setCreatedResults([]);
    setNotifyPod(null);
    try {
      const res = await axios.post(`${API_URL}/monitor/triage`);
      setResult(res.data);
      const autoSelect = new Set<string>();
      (res.data.pods ?? []).forEach((p: PodReport) => {
        if (p.health_status === "UNHEALTHY" && !p.has_incident) autoSelect.add(p.pod_name);
      });
      setSelected(autoSelect);
    } catch (e) { console.error(e); }
    finally { setScanning(false); }
  };

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectAllUnhealthy = () => {
    if (!result) return;
    const unhealthy = result.pods.filter(p => p.health_status === "UNHEALTHY" && !p.has_incident).map(p => p.pod_name);
    setSelected(new Set(unhealthy));
  };

  const handleCreateIncidents = async () => {
    if (selected.size === 0 || !result) return;
    setCreating(true);
    setCreatedResults([]);
    const selectedActions: string[] = [];
    if (actions.slack) selectedActions.push("slack");
    if (actions.jira) selectedActions.push("jira");
    if (actions.teams) selectedActions.push("teams");

    const results: { pod: string; incident_id: number; actions: string[] }[] = [];

    for (const podName of selected) {
      const pod = result.pods.find(p => p.pod_name === podName);
      if (!pod || pod.has_incident) continue;
      try {
        const res = await axios.post(`${API_URL}/incidents`, {
          title: `${pod.diagnostic?.split(":")[0] || "Pod unhealthy"} — ${pod.pod_name}`,
          description: `Pod ${pod.pod_name} est en état ${pod.health_status}.\nRestarts: ${pod.restarts}\nDiagnostic: ${pod.diagnostic || "N/A"}`,
          severity: pod.severity === "healthy" ? "low" : pod.severity,
          source: "scan",
          environment: "prod",
          linked_pod: pod.pod_name,
          actions: selectedActions.length > 0 ? selectedActions : null,
        });
        const incId = res.data.incident?.id;
        if (incId) {
          results.push({ pod: podName, incident_id: incId, actions: ["incident", ...selectedActions] });
        }
        setCreated(prev => new Set(prev).add(podName));
      } catch (e) { console.error(e); }
    }
    setCreatedResults(results);
    setCreating(false);
    setSelected(new Set());
    setTimeout(runScan, 1500);
  };

  const filteredPods = result?.pods.filter(p => {
    if (filter === "unhealthy") return p.health_status === "UNHEALTHY";
    if (filter === "healthy") return p.health_status === "HEALTHY";
    return true;
  }) ?? [];

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Scan du cluster" width={720}>
      <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Scanning state */}
        {scanning && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "2.5px solid var(--b2)", borderTop: "2.5px solid var(--brand)",
              borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.7s linear infinite",
            }} />
            <p style={{ fontFamily: "var(--fm)", fontSize: 13, color: "var(--t2)", fontWeight: 500 }}>Scan en cours...</p>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Analyse des pods du namespace</p>
          </div>
        )}

        {/* Results */}
        {result && !scanning && (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--s1)", border: "0.5px solid var(--b1)" }}>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total pods</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--t1)", marginTop: 4 }}>{result.total}</div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>namespace {result.namespace}</div>
              </div>
              <div style={{
                padding: "14px 16px", borderRadius: 10,
                background: result.unhealthy > 0 ? "rgba(193,52,52,0.04)" : "rgba(45,139,95,0.04)",
                border: `0.5px solid ${result.unhealthy > 0 ? "rgba(193,52,52,0.12)" : "rgba(45,139,95,0.12)"}`,
              }}>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Problématiques</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: result.unhealthy > 0 ? "#C13434" : "#2D8B5F", marginTop: 4 }}>{result.unhealthy}</div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>nécessitent attention</div>
              </div>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(45,139,95,0.04)", border: "0.5px solid rgba(45,139,95,0.12)" }}>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sains</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2D8B5F", marginTop: 4 }}>{result.healthy}</div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>aucune action requise</div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {([["all", `Tous (${result.total})`], ["unhealthy", `Problèmes (${result.unhealthy})`], ["healthy", `Sains (${result.healthy})`]] as [string, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k as any)} style={{
                    padding: "5px 12px", borderRadius: 7, fontFamily: "var(--fm)", fontSize: 11,
                    cursor: "pointer", border: filter === k ? "1px solid var(--brand-b)" : "1px solid transparent",
                    background: filter === k ? "var(--brand-a)" : "transparent",
                    color: filter === k ? "var(--brand)" : "var(--t3)", fontWeight: filter === k ? 600 : 400,
                  }}>{l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={selectAllUnhealthy} style={{
                  padding: "5px 12px", borderRadius: 7, fontFamily: "var(--fm)", fontSize: 11,
                  cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)",
                }}>Sélectionner problèmes</button>
                <button onClick={runScan} style={{
                  padding: "5px 12px", borderRadius: 7, fontFamily: "var(--fm)", fontSize: 11,
                  cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)",
                }}>Re-scanner</button>
              </div>
            </div>

            {/* Pod list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
              {filteredPods.map(pod => {
                const sev = SEV_STYLE[pod.severity] || SEV_STYLE.healthy;
                const isSelected = selected.has(pod.pod_name);
                const isCreated = created.has(pod.pod_name);
                const isExpanded = expandedPod === pod.pod_name;
                const isUnhealthy = pod.health_status === "UNHEALTHY";

                return (
                  <div key={pod.pod_name} style={{
                    background: "var(--s1)", border: `0.5px solid ${isSelected ? sev.border : "var(--b1)"}`,
                    borderRadius: 10, overflow: "hidden", transition: "all 0.15s",
                    borderLeft: isUnhealthy ? `3px solid ${sev.color}` : "3px solid transparent",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer",
                    }} onClick={() => setExpandedPod(isExpanded ? null : pod.pod_name)}>

                      {/* Already has incident — notify button */}
                      {pod.has_incident && (
                        <button
                          onClick={e => { e.stopPropagation(); setNotifyPod(pod); }}
                          style={{
                            fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
                            color: "var(--brand)", background: "var(--brand-a)",
                            border: "1px solid var(--brand-b)", borderRadius: 6,
                            padding: "4px 8px", cursor: "pointer", flexShrink: 0,
                          }}
                        >Notifier</button>
                      )}

                      {/* Checkbox */}
                      {isUnhealthy && !pod.has_incident && (
                        <div
                          onClick={e => { e.stopPropagation(); toggleSelect(pod.pod_name); }}
                          style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: isSelected ? `2px solid ${sev.color}` : "2px solid var(--b2)",
                            background: isSelected ? sev.bg : "transparent",
                            display: "grid", placeItems: "center", cursor: "pointer",
                            transition: "all 0.12s",
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={sev.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="13 4 6 11 3 8"/>
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Status dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: isUnhealthy ? sev.color : "#2D8B5F",
                      }} />

                      {/* Pod info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "var(--fm)", fontSize: 12.5, fontWeight: 600,
                          color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{pod.pod_name}</div>
                        <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                          {pod.internal_phase} · {pod.restarts} restart{pod.restarts !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Severity badge */}
                      {isUnhealthy && (
                        <span style={{
                          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 700,
                          color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
                          padding: "2px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>{sev.label}</span>
                      )}

                      {/* Incident badge */}
                      {pod.has_incident && (
                        <a href="/incidents" onClick={e => e.stopPropagation()} style={{
                          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
                          color: "#B87514", background: "rgba(184,117,20,0.06)", border: "1px solid rgba(184,117,20,0.15)",
                          padding: "2px 8px", borderRadius: 6, textDecoration: "none",
                        }}>INC #{pod.incident_id}</a>
                      )}
                      {isCreated && (
                        <span style={{
                          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
                          color: "#2D8B5F", background: "rgba(45,139,95,0.06)", border: "1px solid rgba(45,139,95,0.15)",
                          padding: "2px 8px", borderRadius: 6,
                        }}>Créé</span>
                      )}

                      {/* Expand chevron */}
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"
                        style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                        <path d="M6 4l4 4-4 4"/>
                      </svg>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{
                        padding: "0 16px 14px", borderTop: "0.5px solid var(--b1)",
                        marginTop: -2, paddingTop: 12,
                      }}>
                        <div style={{
                          fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.6,
                          background: "var(--s2)", padding: "10px 14px", borderRadius: 8,
                          whiteSpace: "pre-wrap", wordBreak: "break-all",
                        }}>
                          {pod.diagnostic || "Aucun diagnostic disponible"}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 10, fontFamily: "var(--fm)", fontSize: 11 }}>
                          <span style={{ color: "var(--t3)" }}>Phase: <span style={{ color: "var(--t1)", fontWeight: 500 }}>{pod.internal_phase}</span></span>
                          <span style={{ color: "var(--t3)" }}>Restarts: <span style={{ color: isUnhealthy ? sev.color : "var(--t1)", fontWeight: 600 }}>{pod.restarts}</span></span>
                          <span style={{ color: "var(--t3)" }}>Statut: <span style={{ color: isUnhealthy ? sev.color : "#2D8B5F", fontWeight: 600 }}>{pod.health_status}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action bar (when pods selected) */}
            {selected.size > 0 && (
              <div style={{
                padding: "16px 18px", borderRadius: 10,
                background: "var(--s1)", border: "0.5px solid var(--brand-b)",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>
                    {selected.size} pod{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
                  </span>
                  <button onClick={() => setSelected(new Set())} style={{
                    fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", background: "none",
                    border: "none", cursor: "pointer", textDecoration: "underline",
                  }}>Tout désélectionner</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionChip label="Créer incidents" active={actions.incident} icon="INC"
                    color="var(--brand)" onChange={() => setActions(p => ({ ...p, incident: !p.incident }))} />
                  <ActionChip label="Canal Slack" active={actions.slack} icon="SLK"
                    color="var(--slack)" onChange={() => setActions(p => ({ ...p, slack: !p.slack }))} />
                  {activeIntegrations.includes("jira") && (
                    <ActionChip label="Ticket Jira" active={actions.jira} icon="JRA"
                      color="#0052CC" onChange={() => setActions(p => ({ ...p, jira: !p.jira }))} />
                  )}
                  {activeIntegrations.includes("teams") && (
                    <ActionChip label="Notif Teams" active={actions.teams || false} icon="TMS"
                      color="#6264A7" onChange={() => setActions(p => ({ ...p, teams: !p.teams }))} />
                  )}
                </div>
                <button onClick={handleCreateIncidents} disabled={creating || !actions.incident} style={{
                  width: "100%", padding: "11px 0", borderRadius: 8,
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 700,
                  cursor: (creating || !actions.incident) ? "not-allowed" : "pointer",
                  border: "none", color: "#fff",
                  background: "var(--brand)",
                  opacity: (creating || !actions.incident) ? 0.5 : 1,
                  boxShadow: "0 2px 8px rgba(193,95,60,0.25)",
                  transition: "all 0.15s",
                }}>
                  {creating ? "Création en cours..." : `Escalader ${selected.size} pod${selected.size > 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {/* Feedback after creation */}
            {createdResults.length > 0 && (
              <div style={{
                padding: "16px 18px", borderRadius: 10,
                background: "rgba(45,139,95,0.04)", border: "1px solid rgba(45,139,95,0.15)",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#2D8B5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2L6 10l-4-4"/>
                  </svg>
                  <span style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 600, color: "#2D8B5F" }}>
                    {createdResults.length} incident{createdResults.length > 1 ? "s" : ""} créé{createdResults.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {createdResults.map(r => (
                    <div key={r.incident_id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 8,
                      background: "var(--s1)", border: "0.5px solid var(--b1)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600,
                          color: "var(--brand)", background: "var(--brand-a)",
                          padding: "2px 7px", borderRadius: 5,
                        }}>INC #{r.incident_id}</span>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.pod}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {r.actions.includes("slack") && <span style={{ fontFamily: "var(--fm)", fontSize: 8, fontWeight: 700, color: "#E01E5A", background: "rgba(224,30,90,0.06)", padding: "2px 5px", borderRadius: 4 }}>SLK</span>}
                        {r.actions.includes("jira") && <span style={{ fontFamily: "var(--fm)", fontSize: 8, fontWeight: 700, color: "#0052CC", background: "rgba(0,82,204,0.06)", padding: "2px 5px", borderRadius: 4 }}>JRA</span>}
                        {r.actions.includes("teams") && <span style={{ fontFamily: "var(--fm)", fontSize: 8, fontWeight: 700, color: "#6264A7", background: "rgba(98,100,167,0.06)", padding: "2px 5px", borderRadius: 4 }}>TMS</span>}
                        <a href="/incidents" style={{
                          fontFamily: "var(--fm)", fontSize: 10, color: "var(--brand)", textDecoration: "none", marginLeft: 6,
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          Voir
                          <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 3h7v7M13 3L6 10"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCreatedResults([])} style={{
                  fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", background: "none",
                  border: "none", cursor: "pointer", alignSelf: "flex-end",
                }}>Fermer</button>
              </div>
            )}

            {/* Notify existing incident panel */}
            {notifyPod && notifyPod.has_incident && (
              <NotifyPanel
                pod={notifyPod}
                activeIntegrations={activeIntegrations}
                onClose={() => setNotifyPod(null)}
              />
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Modal>
  );
}


function ActionChip({ label, active, icon, color, onChange }: {
  label: string; active: boolean; icon: string; color: string; onChange: () => void;
}) {
  return (
    <button onClick={onChange} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 8, cursor: "pointer",
      border: active ? `1.5px solid ${color}` : "1.5px solid var(--b1)",
      background: active ? `${color}08` : "transparent",
      transition: "all 0.15s",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 5,
        background: active ? `${color}15` : "var(--s2)",
        display: "grid", placeItems: "center",
        fontFamily: "var(--fm)", fontSize: 7, fontWeight: 700,
        color: active ? color : "var(--t3)",
      }}>{icon}</div>
      <span style={{
        fontFamily: "var(--fm)", fontSize: 11, fontWeight: active ? 600 : 400,
        color: active ? color : "var(--t3)",
      }}>{label}</span>
    </button>
  );
}


function NotifyPanel({ pod, activeIntegrations, onClose }: {
  pod: PodReport; activeIntegrations: string[]; onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]);

  const notify = async (type: string) => {
    setSending(true);
    try {
      await axios.post(`${API_URL}/incidents/${pod.incident_id}/notify`, { channel: type });
      setSent(prev => [...prev, type]);
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  const channels = [
    { key: "slack", label: "Slack", color: "#E01E5A", desc: "Créer ou notifier le canal" },
    ...(activeIntegrations.includes("jira") ? [{ key: "jira", label: "Jira", color: "#0052CC", desc: "Créer un ticket" }] : []),
    ...(activeIntegrations.includes("teams") ? [{ key: "teams", label: "Teams", color: "#6264A7", desc: "Envoyer une notification" }] : []),
  ];

  return (
    <div style={{
      padding: "18px 20px", borderRadius: 10,
      background: "var(--s1)", border: "0.5px solid var(--b2)",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600,
              color: "#B87514", background: "rgba(184,117,20,0.06)", border: "1px solid rgba(184,117,20,0.15)",
              padding: "2px 8px", borderRadius: 5,
            }}>INC #{pod.incident_id}</span>
            <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
              Notifier l'équipe
            </span>
          </div>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
            Un incident existe déjà pour ce déploiement. Choisissez où envoyer la notification.
          </p>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
          width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center",
          flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Pod info */}
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "var(--s2)", border: "0.5px solid var(--b1)",
        fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)",
      }}>
        <span style={{ color: "var(--t1)", fontWeight: 500 }}>{pod.pod_name}</span>
        <span style={{ margin: "0 8px", color: "var(--b3)" }}>·</span>
        {pod.restarts} restarts
        <span style={{ margin: "0 8px", color: "var(--b3)" }}>·</span>
        {pod.health_status}
      </div>

      {/* Channel buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        {channels.map(c => {
          const isSent = sent.includes(c.key);
          return (
            <button key={c.key} onClick={() => !isSent && !sending && notify(c.key)} disabled={sending || isSent} style={{
              flex: 1, padding: "12px 8px", borderRadius: 8,
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
              cursor: (sending || isSent) ? "not-allowed" : "pointer",
              border: isSent ? `1.5px solid ${c.color}` : "1.5px solid var(--b2)",
              background: isSent ? `${c.color}06` : "var(--s1)",
              color: isSent ? c.color : "var(--t1)",
              transition: "all 0.15s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 13 }}>{isSent ? "✓ " : ""}{c.label}</span>
              <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: isSent ? c.color : "var(--t3)", fontWeight: 400 }}>
                {isSent ? "Envoyé" : c.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Success message */}
      {sent.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(45,139,95,0.04)", border: "0.5px solid rgba(45,139,95,0.12)",
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#2D8B5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2L6 10l-4-4"/>
          </svg>
          <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "#2D8B5F", fontWeight: 500 }}>
            Notification envoyée sur {sent.join(", ")}
          </span>
          <a href="/incidents" style={{
            fontFamily: "var(--fm)", fontSize: 10, color: "var(--brand)", textDecoration: "none", marginLeft: "auto",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            Voir l'incident
            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 3h7v7M13 3L6 10"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}