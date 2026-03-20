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

export default function Dashboard({ onScan }: { onScan?: () => void }) {
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPods(); }, [namespace]);

  const analyzeAndRemediate = async (pod: Pod) => {
    try {
      const res = await axios.post(`${API_URL}/remediation/analyze`, { pod_name: pod.pod_name });
      setModal({ pod, analysis: res.data.analysis, actions: res.data.proposed_actions || [] });
    } catch (e) { console.error(e); }
  };

  const healthColor = healthPct >= 80 ? "var(--g)" : healthPct >= 50 ? "var(--am)" : "var(--re)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>k3d-local · {namespace}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <select value={namespace} onChange={e => setNamespace(e.target.value)} style={{
              background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: 8,
              color: "var(--t1)", fontSize: 13, padding: "8px 32px 8px 12px",
              cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none",
            }}>
              <option value="default">default</option>
              <option value="kube-system">kube-system</option>
              <option value="monitoring">monitoring</option>
            </select>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </div>
          <button onClick={() => { fetchPods(); if (onScan) onScan(); }} disabled={loading} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", border: "none",
            background: "var(--t1)", color: "#fff",
            opacity: loading ? 0.6 : 1, transition: "all 0.15s",
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <path d="M14.5 8A6.5 6.5 0 101.5 8"/><path d="M14.5 8l-2.2-2.2M14.5 8l-2.2 2.2"/>
            </svg>
            {loading ? "Scan..." : "Scanner"}
          </button>
        </div>
      </div>

      {/* Stats — seamless joined cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {[
          { label: "Total pods", val: pods.length || "—", sub: namespace },
          { label: "Healthy", val: pods.length ? healthy : "—", sub: pods.length ? `${healthPct}%` : "—", color: "var(--g)" },
          { label: "Unhealthy", val: pods.length ? unhealthy : "—", sub: unhealthy > 0 ? "action needed" : "all clear", color: unhealthy > 0 ? "var(--re)" : "var(--g)" },
          { label: "Health", val: pods.length ? `${healthPct}%` : "—", sub: `${healthy}/${pods.length}`, color: healthColor },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--s1)", padding: "20px 24px" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color || "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main 2-col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>

        {/* Pods list */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>Pods</h2>
              {pods.length > 0 && <span style={{ fontSize: 12, color: "var(--t3)", background: "var(--s2)", padding: "2px 8px", borderRadius: 6 }}>{pods.length}</span>}
              {unhealthy > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--re)", fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--re)", animation: "pulse 2s infinite" }} />
                  {unhealthy} unhealthy
                </span>
              )}
            </div>
          </div>

          {pods.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--b2)", borderRadius: 12 }}>
              <p style={{ fontSize: 14, color: "var(--t3)" }}>{loading ? "Scanning cluster..." : "Run a scan to see your pods"}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
              {pods.map(pod => {
                const h = pod.health_status === "HEALTHY";
                return (
                  <div key={pod.pod_name} onClick={() => !h && analyzeAndRemediate(pod)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 18px", background: "var(--s1)",
                    cursor: h ? "default" : "pointer", transition: "background 0.1s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: h ? "var(--g)" : "var(--re)", animation: h ? "none" : "pulse 2s infinite" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pod.pod_name}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{pod.internal_phase}{pod.restarts > 0 ? ` · ${pod.restarts} restarts` : ""}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, color: h ? "var(--g)" : "var(--re)", background: h ? "var(--g-a)" : "var(--re-a)" }}>
                      {h ? "Healthy" : "Unhealthy"}
                    </span>
                  </div>
                );
              })}
              {/* Health bar */}
              <div style={{ padding: "12px 18px", background: "var(--s1)", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>Health</span>
                <div style={{ flex: 1, height: 4, background: "var(--s3)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${healthPct}%`, background: healthColor, transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: healthColor }}>{healthPct}%</span>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>{healthy}/{pods.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Cluster</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 10, overflow: "hidden" }}>
              {[
                { l: "Provider", v: "K3s" }, { l: "Region", v: "Local" },
                { l: "Namespace", v: namespace },
                { l: "Pods", v: pods.length > 0 ? `${pods.length}` : "—" },
                { l: "Healthy", v: pods.length > 0 ? `${healthy}` : "—" },
              ].map(item => (
                <div key={item.l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "var(--s1)" }}>
                  <span style={{ fontSize: 13, color: "var(--t3)" }}>{item.l}</span>
                  <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { l: "Scanner le cluster", action: () => { if (onScan) onScan(); } },
                { l: "Voir les incidents", action: () => window.location.href = "/incidents" },
                { l: "Historique des scans", action: () => window.location.href = "/scans" },
              ].map(a => (
                <button key={a.l} onClick={a.action} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--s1)", border: "1px solid var(--b1)",
                  color: "var(--t2)", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  textAlign: "left", transition: "all 0.12s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3l5 5-5 5"/></svg>
                  {a.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent incidents */}
      <IncidentsWidget />

      {/* Remediation Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.15s ease" }}>
          <div style={{ background: "var(--s1)", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", animation: "scaleIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--b1)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>Remediation</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{modal.pod.pod_name} · {modal.pod.restarts} restarts</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
              </button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{modal.analysis}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Incidents Widget ═══ */
function IncidentsWidget() {
  const [incidents, setIncidents] = useState<any[]>([]);
  useEffect(() => {
    axios.get(`${API_URL}/incidents`).then(r => setIncidents((r.data.incidents || []).slice(0, 5))).catch(() => {});
  }, []);
  if (incidents.length === 0) return null;

  const SEV: Record<string, string> = { critical: "var(--sev-critical)", high: "var(--sev-high)", medium: "var(--sev-medium)", low: "var(--sev-low)" };
  const STA: Record<string, { color: string; label: string }> = { open: { color: "var(--re)", label: "Open" }, in_progress: { color: "var(--am)", label: "In progress" }, resolved: { color: "var(--g)", label: "Resolved" }, watching: { color: "var(--bl)", label: "Watching" } };
  function ago(d: string) { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>Recent incidents</h2>
        <a href="/incidents" style={{ fontSize: 13, color: "var(--t3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, transition: "color 0.1s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
        >
          View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3l5 5-5 5"/></svg>
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {incidents.map(inc => {
          const s = STA[inc.status] || STA.open;
          const sevColor = SEV[inc.severity] || "var(--t2)";
          return (
            <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "var(--s1)", cursor: "pointer", transition: "background 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}
              onClick={() => window.location.href = `/incidents/${inc.id}`}
            >
              <span style={{ fontSize: 12, color: "var(--t3)", minWidth: 32 }}>#{inc.id}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sevColor, background: `${sevColor}10`, minWidth: 70 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} /> {inc.severity}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: s.color, background: `${s.color}08` }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} /> {s.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--t3)", minWidth: 30, textAlign: "right" }}>{ago(inc.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}