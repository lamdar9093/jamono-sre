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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            // k3d-local · namespace {namespace}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
              padding: "4px 8px",
              cursor: "pointer",
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
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 5,
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", border: "1px solid var(--b2)",
              background: "transparent", color: "var(--t2)",
              transition: "all 0.1s",
            }}
          >
            {loading ? "Scan..." : "↻ Scanner"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { label: "Pods total", val: pods.length || "—", color: "var(--jam2)", meta: `namespace ${namespace}` },
          { label: "Sains", val: pods.length ? healthy : "—", color: "var(--g)", meta: pods.length ? `${healthPct}% healthy` : "—" },
          { label: "En erreur", val: pods.length ? unhealthy : "—", color: "var(--re)", meta: unhealthy > 0 ? "attention requise" : "tout va bien" },
          { label: "Santé globale", val: pods.length ? `${healthPct}%` : "—", color: sevColor(healthPct), meta: `${healthy}/${pods.length} pods` },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--s1)", border: "1px solid var(--b1)",
            borderRadius: "var(--r)", padding: "12px 14px",
            transition: "border-color 0.15s",
          }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, color: s.color }}>
              {s.val}
            </div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 6 }}>
              {s.meta}
            </div>
          </div>
        ))}
      </div>

      {/* Pods */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 14px", borderBottom: "1px solid var(--b1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)" }} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Pods — {namespace}
            </span>
            {pods.length > 0 && (
              <span style={{
                fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)",
                background: "var(--s2)", border: "1px solid var(--b2)",
                padding: "1px 5px", borderRadius: 3,
              }}>
                {pods.length}
              </span>
            )}
          </div>
        </div>

        {pods.length === 0 ? (
          <div style={{ padding: "32px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
              {loading ? "Scan en cours..." : "Lance un scan pour analyser le cluster"}
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 6,
              padding: 10,
            }}>
              {pods.map((pod) => {
                const h = pod.health_status === "HEALTHY";
                return (
                  <div
                    key={pod.pod_name}
                    onClick={() => !h && analyzeAndRemediate(pod)}
                    style={{
                      background: h ? "var(--s2)" : "rgba(184,56,56,0.04)",
                      border: h ? "1px solid var(--b1)" : "1px solid rgba(184,56,56,0.2)",
                      borderRadius: 5,
                      padding: "9px 10px",
                      cursor: h ? "default" : "pointer",
                      position: "relative",
                      overflow: "hidden",
                      transition: "border-color 0.1s",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
                      background: h ? "var(--g)" : "var(--re)",
                    }} />
                    <div style={{
                      fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t1)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      marginBottom: 8,
                    }}>
                      {pod.pod_name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontFamily: "var(--fm)", fontSize: 8.5, fontWeight: 500,
                        textTransform: "uppercase", letterSpacing: "0.07em",
                        color: h ? "var(--g)" : "var(--re)",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <span style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: "currentColor", display: "inline-block",
                        }} />
                        {h ? "healthy" : "unhealthy"}
                      </span>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>
                        {pod.restarts}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Health bar */}
            <div style={{
              padding: "8px 14px",
              borderTop: "1px solid var(--b1)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", whiteSpace: "nowrap" }}>
                santé globale
              </span>
              <div style={{ flex: 1, height: 3, background: "var(--b2)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${healthPct}%`,
                  background: sevColor(healthPct),
                  transition: "width 0.4s ease",
                }} />
              </div>
              <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", whiteSpace: "nowrap" }}>
                {healthPct}% — {healthy}/{pods.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Remediation Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            background: "var(--s1)",
            border: "1px solid var(--b2)",
            borderRadius: 10,
            width: "100%", maxWidth: 520,
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--b1)",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
                  Remédiation — {modal.pod.pod_name}
                </div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--re)", marginTop: 2 }}>
                  {modal.pod.restarts} restarts · {modal.pod.diagnostic}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {modal.analysis}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}