import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface ClusterStats {
  pods_total: number;
  pods_healthy: number;
  pods_unhealthy: number;
  total_restarts: number;
}

interface ClusterProvider {
  id: string;
  name: string;
  color: string;
}

interface Cluster {
  id: string;
  name: string;
  context: string;
  provider: ClusterProvider;
  region: string;
  k8s_version: string;
  node_count: number;
  namespaces: string[];
  watched_namespace: string;
  health: "healthy" | "degraded" | "critical";
  stats: ClusterStats;
  connected_at: string;
}

const HEALTH: Record<string, { color: string; bg: string; label: string }> = {
  healthy:  { color: "var(--g)",  bg: "var(--g-a)",  label: "Sain" },
  degraded: { color: "var(--am)", bg: "var(--am-a)", label: "Dégradé" },
  critical: { color: "var(--re)", bg: "var(--re-a)", label: "Critique" },
};

const PROVIDER_ICON: Record<string, string> = {
  eks: "AWS", aks: "AZ", gke: "GC", rke: "RKE", k3s: "K3s",
};

export default function Clusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [k8sAvailable, setK8sAvailable] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/clusters`);
      setClusters(res.data.clusters ?? []);
      setK8sAvailable(res.data.k8s_available ?? false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const totalPods = clusters.reduce((s, c) => s + c.stats.pods_total, 0);
  const totalHealthy = clusters.reduce((s, c) => s + c.stats.pods_healthy, 0);
  const totalUnhealthy = clusters.reduce((s, c) => s + c.stats.pods_unhealthy, 0);
  const totalRestarts = clusters.reduce((s, c) => s + c.stats.total_restarts, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Clusters</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} connecté{clusters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={fetch} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 16px", borderRadius: "var(--r)",
          fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--b2)",
          background: "transparent", color: "var(--t2)",
          transition: "all 0.12s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
        >↻ Rafraîchir</button>
      </div>

      {/* Fleet stats */}
      {clusters.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "Pods total", val: totalPods, color: "var(--brand)" },
            { label: "Healthy", val: totalHealthy, color: "var(--g)" },
            { label: "Unhealthy", val: totalUnhealthy, color: "var(--re)" },
            { label: "Restarts", val: totalRestarts, color: "var(--am)" },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: "var(--r)", padding: "16px 18px",
              position: "relative", overflow: "hidden",
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${s.color}35`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.color}, transparent)`, opacity: 0.5 }} />
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: s.color, fontFamily: "var(--fm)" }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement des clusters...</p>
        </div>
      )}

      {/* No K8s */}
      {!loading && !k8sAvailable && (
        <div style={{
          background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)",
          padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--am-a)", border: "1px solid rgba(251,191,36,0.2)", display: "grid", placeItems: "center" }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="var(--am)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2L14 13H2L8 2z"/><path d="M8 7v2.5M8 11.5v.5"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Aucun cluster connecté</div>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", maxWidth: 360, lineHeight: 1.6 }}>
            Kubernetes n'est pas disponible. Vérifie ta kubeconfig ou connecte-toi à un cluster pour commencer.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && k8sAvailable && clusters.length === 0 && (
        <div style={{
          background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
            K8s disponible mais aucun cluster retourné. Vérifie la configuration.
          </p>
        </div>
      )}

      {/* Cluster cards */}
      {!loading && clusters.map(cluster => {
        const h = HEALTH[cluster.health] || HEALTH.healthy;
        const isExpanded = expanded === cluster.id;
        const healthPct = cluster.stats.pods_total > 0
          ? Math.round((cluster.stats.pods_healthy / cluster.stats.pods_total) * 100) : 100;

        return (
          <div key={cluster.id} style={{
            background: "var(--s1)", border: "1px solid var(--b1)",
            borderRadius: "var(--r)", overflow: "hidden",
            transition: "border-color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${cluster.provider.color}30`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"}
          >
            {/* Top accent */}
            <div style={{ height: 2, background: `linear-gradient(90deg, ${cluster.provider.color}, transparent)` }} />

            {/* Main row */}
            <div
              onClick={() => setExpanded(isExpanded ? null : cluster.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: "pointer" }}
            >
              {/* Provider badge */}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${cluster.provider.color}18`,
                border: `1px solid ${cluster.provider.color}30`,
                display: "grid", placeItems: "center",
                fontFamily: "var(--fm)", fontSize: 11, fontWeight: 700,
                color: cluster.provider.color, flexShrink: 0,
              }}>
                {PROVIDER_ICON[cluster.provider.id] || "K8s"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{cluster.name}</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 5,
                    fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600,
                    color: h.color, background: h.bg,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", boxShadow: cluster.health !== "healthy" ? `0 0 6px ${h.color}60` : "none", animation: cluster.health !== "healthy" ? "pulse 2s infinite" : "none" }} />
                    {h.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{cluster.provider.name}</span>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{cluster.region}</span>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{cluster.k8s_version}</span>
                </div>
              </div>

              {/* Mini stats */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{cluster.node_count}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase" }}>nodes</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{cluster.stats.pods_total}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase" }}>pods</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 16, fontWeight: 700, color: healthPct === 100 ? "var(--g)" : "var(--am)" }}>{healthPct}%</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase" }}>santé</div>
                </div>
              </div>

              {/* Chevron */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"
                style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </div>

            {/* Health bar */}
            <div style={{ height: 3, background: "var(--b1)", margin: "0 18px" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${healthPct}%`,
                background: healthPct === 100 ? "var(--g)" : healthPct > 50 ? "var(--am)" : "var(--re)",
                transition: "width 0.5s ease",
              }} />
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: "16px 18px", borderTop: "1px solid var(--b1)", marginTop: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                  {/* Info card */}
                  <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--b1)" }}>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Informations</span>
                    </div>
                    {[
                      ["Contexte", cluster.context],
                      ["Provider", cluster.provider.name],
                      ["Région", cluster.region],
                      ["Version K8s", cluster.k8s_version],
                      ["Nodes", String(cluster.node_count)],
                      ["Namespace surveillé", cluster.watched_namespace],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid var(--b1)" }}>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>{k}</span>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pods card */}
                  <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--b1)" }}>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Pods ({cluster.watched_namespace})</span>
                    </div>
                    <div style={{ padding: "14px 12px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                      {[
                        { label: "Total", val: cluster.stats.pods_total, color: "var(--brand)" },
                        { label: "Healthy", val: cluster.stats.pods_healthy, color: "var(--g)" },
                        { label: "Unhealthy", val: cluster.stats.pods_unhealthy, color: "var(--re)" },
                        { label: "Restarts", val: cluster.stats.total_restarts, color: "var(--am)" },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                          <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Namespaces */}
                {cluster.namespaces.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Namespaces</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {cluster.namespaces.map(ns => (
                        <span key={ns} style={{
                          padding: "3px 9px", borderRadius: 5,
                          fontFamily: "var(--fm)", fontSize: 10,
                          color: ns === cluster.watched_namespace ? "var(--brand2)" : "var(--t3)",
                          background: ns === cluster.watched_namespace ? "var(--brand-a)" : "var(--s2)",
                          border: ns === cluster.watched_namespace ? "1px solid var(--brand-b)" : "1px solid var(--b2)",
                          fontWeight: ns === cluster.watched_namespace ? 600 : 400,
                        }}>
                          {ns}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}