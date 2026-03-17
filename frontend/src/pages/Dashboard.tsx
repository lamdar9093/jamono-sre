import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Pod {
  pod_name: string;
  health_status: "HEALTHY" | "UNHEALTHY";
  restarts: number;
  diagnostic: string;
  internal_phase: string;
}

interface RemediationModal {
  pod: Pod;
  analysis: string;
  actions: any[];
}

export default function Dashboard() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<RemediationModal | null>(null);
  const [namespace, setNamespace] = useState("default");

  const healthy = pods.filter(p => p.health_status === "HEALTHY").length;
  const unhealthy = pods.filter(p => p.health_status === "UNHEALTHY").length;
  const healthPct = pods.length ? Math.round((healthy / pods.length) * 100) : 0;

  const fetchPods = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/pods?namespace=${namespace}`);
      setPods(res.data.pods || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/monitor/scan`);
      await fetchPods();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPods(); }, [namespace]);

  const analyzeAndRemediate = async (pod: Pod) => {
    try {
      const res = await axios.post(`${API_URL}/remediation/analyze`, { pod_name: pod.pod_name });
      setModal({ pod, analysis: res.data.analysis, actions: res.data.proposed_actions || [] });
    } catch (e) {
      console.error(e);
    }
  };

  const sevColor = (pct: number) => pct >= 80 ? "var(--g)" : pct >= 50 ? "var(--am)" : "var(--re)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            {/* Provider mini badge */}
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              background: "var(--k3s)18", border: "1px solid var(--k3s)30",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--fm)", fontSize: 7, fontWeight: 800, color: "var(--k3s)",
            }}>K3s</div>
            <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
              k3d-local · namespace <span style={{ color: "var(--t2)" }}>{namespace}</span>
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
            style={{
              background: "var(--s2)",
              border: "1px solid var(--b2)",
              borderRadius: "var(--r)",
              color: "var(--t2)",
              fontFamily: "var(--fm)",
              fontSize: 11,
              padding: "6px 10px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="default">default</option>
            <option value="kube-system">kube-system</option>
            <option value="monitoring">monitoring</option>
          </select>
          <button
            onClick={fetchPods}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: "var(--r)",
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              background: "var(--brand)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(193,95,60,0.25)",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <path d="M14.5 8A6.5 6.5 0 101.5 8"/><path d="M14.5 8l-2.2-2.2M14.5 8l-2.2 2.2"/>
            </svg>
            {loading ? "Scan..." : "Scanner"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Pods total", val: pods.length || "—", color: "var(--brand)", sub: `namespace ${namespace}` },
          { label: "Sains", val: pods.length ? healthy : "—", color: "var(--g)", sub: pods.length ? `${healthPct}% healthy` : "—" },
          { label: "En erreur", val: pods.length ? unhealthy : "—", color: unhealthy > 0 ? "var(--re)" : "var(--g)", sub: unhealthy > 0 ? "action requise" : "tout va bien" },
          { label: "Santé globale", val: pods.length ? `${healthPct}%` : "—", color: sevColor(healthPct), sub: `${healthy}/${pods.length} pods` },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--s1)", border: "1px solid var(--b1)",
            borderRadius: "var(--r)", padding: "16px 18px",
            position: "relative", overflow: "hidden",
            transition: "border-color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${s.color}35`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"}
          >
            {/* Top accent bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${s.color}, transparent)`, opacity: 0.5,
            }} />
            <div style={{
              fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em",
              lineHeight: 1, color: s.color, fontFamily: "var(--fm)",
            }}>
              {s.val}
            </div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 6 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Pods + Cluster info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>

        {/* Pod Grid */}
        <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", borderBottom: "1px solid var(--b1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: unhealthy > 0 ? "var(--re)" : "var(--g)",
                boxShadow: unhealthy > 0 ? "0 0 6px var(--re)50" : "0 0 6px var(--g)50",
                animation: unhealthy > 0 ? "pulse 2s infinite" : "none",
              }} />
              <span style={{
                fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)",
                textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
              }}>
                Pods — {namespace}
              </span>
              {pods.length > 0 && (
                <span style={{
                  fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)",
                  background: "var(--s2)", border: "1px solid var(--b2)",
                  padding: "1px 6px", borderRadius: 4,
                }}>
                  {pods.length}
                </span>
              )}
            </div>
          </div>

          {pods.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
                {loading ? "Scan en cours..." : "Lance un scan pour analyser le cluster"}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 8,
                padding: 12,
              }}>
                {pods.map((pod) => {
                  const h = pod.health_status === "HEALTHY";
                  return (
                    <div
                      key={pod.pod_name}
                      onClick={() => !h && analyzeAndRemediate(pod)}
                      style={{
                        background: h ? "var(--s2)" : "var(--re-a)",
                        border: h ? "1px solid var(--b1)" : "1px solid rgba(248,113,113,0.25)",
                        borderRadius: "var(--r)",
                        padding: "10px 12px",
                        cursor: h ? "default" : "pointer",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => {
                        if (!h) (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.5)";
                        else (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)";
                      }}
                      onMouseLeave={e => {
                        if (!h) (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.25)";
                        else (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)";
                      }}
                    >
                      {/* Top accent */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, right: 0, height: 2,
                        background: h ? "var(--g)" : "var(--re)",
                        opacity: h ? 0.4 : 0.7,
                      }} />

                      <div style={{
                        fontFamily: "var(--fm)", fontSize: 10, color: "var(--t1)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        marginBottom: 8, fontWeight: 500,
                      }}>
                        {pod.pod_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{
                          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          color: h ? "var(--g)" : "var(--re)",
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: "currentColor", display: "inline-block",
                            boxShadow: h ? "none" : "0 0 6px var(--re)60",
                            animation: h ? "none" : "pulse 2s infinite",
                          }} />
                          {h ? "healthy" : "unhealthy"}
                        </span>
                        {pod.restarts > 0 && (
                          <span style={{
                            fontFamily: "var(--fm)", fontSize: 8, color: "var(--re)",
                            background: "var(--re-a)", padding: "1px 5px", borderRadius: 3,
                            border: "1px solid rgba(248,113,113,0.2)",
                          }}>
                            {pod.restarts}×
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Health bar */}
              <div style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--b1)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>
                  santé globale
                </span>
                <div style={{ flex: 1, height: 4, background: "var(--b2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    width: `${healthPct}%`,
                    background: sevColor(healthPct),
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: sevColor(healthPct), fontWeight: 600, whiteSpace: "nowrap" }}>
                  {healthPct}%
                </span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>
                  {healthy}/{pods.length}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right column — Cluster info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Cluster Resources */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--t2)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="2" width="12" height="12" rx="2"/>
                <rect x="5.5" y="5.5" width="5" height="5"/>
                <line x1="5.5" y1="0.5" x2="5.5" y2="2"/><line x1="10.5" y1="0.5" x2="10.5" y2="2"/>
                <line x1="5.5" y1="14" x2="5.5" y2="15.5"/><line x1="10.5" y1="14" x2="10.5" y2="15.5"/>
              </svg>
              <span style={{
                fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)",
                textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
              }}>Cluster Info</span>
            </div>

            {[
              { l: "Provider", v: "K3s" },
              { l: "Region", v: "Local" },
              { l: "Namespace", v: namespace },
              { l: "Pods", v: pods.length > 0 ? `${pods.length}` : "—" },
              { l: "Healthy", v: pods.length > 0 ? `${healthy}` : "—" },
            ].map(item => (
              <div key={item.l} style={{
                display: "flex", justifyContent: "space-between",
                padding: "7px 0", borderBottom: "1px solid var(--b1)",
                fontSize: 12,
              }}>
                <span style={{ color: "var(--t3)", fontFamily: "var(--fm)", fontSize: 11 }}>{item.l}</span>
                <span style={{ color: "var(--t2)", fontWeight: 500, fontFamily: "var(--fm)", fontSize: 11 }}>{item.v}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "16px 18px" }}>
            <div style={{
              fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)",
              textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 12,
            }}>Actions rapides</div>
            {[
              { l: "Scanner le cluster", color: "var(--brand)", action: handleScan },
              { l: "Voir les incidents", color: "var(--re)", action: () => window.location.href = "/incidents" },
              { l: "Historique", color: "var(--purple)", action: () => window.location.href = "/history" },
            ].map(a => (
              <button key={a.l} onClick={a.action} style={{
                display: "block", width: "100%", padding: "9px 12px", marginBottom: 6,
                borderRadius: "var(--r)",
                background: `${a.color}12`, border: `1px solid ${a.color}20`,
                color: a.color, cursor: "pointer",
                fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
                textAlign: "left", transition: "all 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}20`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}12`; }}
              >{a.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Widget */}
      <IncidentsWidget />

      {/* Remediation Modal — logic preserved */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
          animation: "fadeIn 0.15s ease",
        }}>
          <div style={{
            background: "var(--s1)",
            border: "1px solid var(--b2)",
            borderRadius: 14,
            width: "100%", maxWidth: 520,
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
            animation: "scaleIn 0.2s ease",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid var(--b1)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
                  Remédiation — {modal.pod.pod_name}
                </div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--re)", marginTop: 3 }}>
                  {modal.pod.restarts} restarts · {modal.pod.diagnostic}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{
                  background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
                  width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {modal.analysis}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══ Incidents Widget (bottom of dashboard) ═══ */
function IncidentsWidget() {
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_URL}/incidents`)
      .then(r => setIncidents((r.data.incidents || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  if (incidents.length === 0) return null;

  const SEV: Record<string, string> = {
    critical: "var(--sev-critical)",
    high:     "var(--sev-high)",
    medium:   "var(--sev-medium)",
    low:      "var(--sev-low)",
  };

  const STA: Record<string, { color: string; label: string }> = {
    open:        { color: "var(--re)",  label: "Ouvert" },
    in_progress: { color: "var(--am)",  label: "En cours" },
    resolved:    { color: "var(--g)",   label: "Résolu" },
    watching:    { color: "var(--bl)",  label: "Surveillance" },
  };

  function ago(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 3600) return `${Math.floor(s/60)}min`;
    if (s < 86400) return `${Math.floor(s/3600)}h`;
    return `${Math.floor(s/86400)}j`;
  }

  return (
    <div style={{
      background: "var(--s1)", border: "1px solid var(--b1)",
      borderRadius: "var(--r)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid var(--b1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--re)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{
            fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)",
            textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
          }}>
            Incidents récents
          </span>
        </div>
        <a href="/incidents" style={{
          fontFamily: "var(--fm)", fontSize: 10, color: "var(--brand)",
          textDecoration: "none", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 4,
          transition: "color 0.1s",
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--brand2)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--brand)"}
        >
          Voir tout
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="6" x2="10" y2="6"/><polyline points="7 3 10 6 7 9"/>
          </svg>
        </a>
      </div>

      {incidents.map((inc, i) => {
        const s = STA[inc.status] || STA.open;
        const sevColor = SEV[inc.severity] || "var(--t2)";
        const pulse = inc.status === "open" || inc.status === "in_progress";
        return (
          <div key={inc.id} style={{
            display: "grid",
            gridTemplateColumns: "32px 80px 1fr 95px 50px",
            alignItems: "center",
            padding: "9px 16px", gap: 10,
            borderBottom: i < incidents.length - 1 ? "1px solid var(--b1)" : "none",
            transition: "background 0.1s",
            cursor: "pointer",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            onClick={() => window.location.href = "/incidents"}
          >
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>
              #{inc.id}
            </span>

            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 5,
              fontFamily: "var(--fm)", fontSize: 9.5, fontWeight: 600,
              color: sevColor,
              background: `${sevColor}14`,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {inc.severity}
            </span>

            <span style={{
              fontFamily: "var(--f)", fontSize: 12.5, fontWeight: 500,
              color: "var(--t1)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {inc.title}
            </span>

            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 5,
              fontFamily: "var(--fm)", fontSize: 9.5, fontWeight: 500,
              color: s.color,
              background: `${s.color}12`,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "currentColor", display: "inline-block",
                animation: pulse ? "pulse 2s infinite" : "none",
              }} />
              {s.label}
            </span>

            <span style={{
              fontFamily: "var(--fm)", fontSize: 10,
              color: "var(--t3)", textAlign: "right",
            }}>
              {ago(inc.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}