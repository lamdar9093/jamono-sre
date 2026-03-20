import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface ClusterStats { pods_total: number; pods_healthy: number; pods_unhealthy: number; total_restarts: number; }
interface ClusterProvider { id: string; name: string; color: string; }
interface Cluster { id: string; name: string; context: string; provider: ClusterProvider; region: string; k8s_version: string; node_count: number; namespaces: string[]; watched_namespace: string; health: "healthy" | "degraded" | "critical"; stats: ClusterStats; connected_at: string; }

const HEALTH: Record<string, { color: string; label: string }> = { healthy: { color: "var(--g)", label: "Sain" }, degraded: { color: "var(--am)", label: "Dégradé" }, critical: { color: "var(--re)", label: "Critique" } };
const PROV: Record<string, string> = { eks: "AWS", aks: "AZ", gke: "GC", rke: "RKE", k3s: "K3s" };

export default function Clusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [k8sAvailable, setK8sAvailable] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = async () => { setLoading(true); try { const res = await axios.get(`${API_URL}/clusters`); setClusters(res.data.clusters ?? []); setK8sAvailable(res.data.k8s_available ?? false); } catch (e) { console.error(e); } finally { setLoading(false); } };
  useEffect(() => { fetchData(); }, []);

  const totalPods = clusters.reduce((s, c) => s + c.stats.pods_total, 0);
  const totalHealthy = clusters.reduce((s, c) => s + c.stats.pods_healthy, 0);
  const totalUnhealthy = clusters.reduce((s, c) => s + c.stats.pods_unhealthy, 0);
  const totalRestarts = clusters.reduce((s, c) => s + c.stats.total_restarts, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Clusters</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{clusters.length} cluster{clusters.length !== 1 ? "s" : ""} connecté{clusters.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={fetchData} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", transition: "all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}>Rafraîchir</button>
      </div>

      {clusters.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Pods total", val: totalPods, color: "var(--t1)" },
            { label: "Healthy", val: totalHealthy, color: "var(--g)" },
            { label: "Unhealthy", val: totalUnhealthy, color: "var(--re)" },
            { label: "Restarts", val: totalRestarts, color: "var(--am)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--s1)", padding: "20px 24px" }}>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: 48, textAlign: "center" }}><p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement des clusters...</p></div>}

      {!loading && !k8sAvailable && (
        <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--b2)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--am)" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2L14 13H2L8 2z"/><path d="M8 7v2.5M8 11.5v.5"/></svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>Aucun cluster connecté</div>
          <p style={{ fontSize: 13, color: "var(--t3)", maxWidth: 360, lineHeight: 1.6 }}>Kubernetes n'est pas disponible. Vérifie ta kubeconfig ou connecte-toi à un cluster.</p>
        </div>
      )}

      {!loading && k8sAvailable && clusters.length === 0 && (
        <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--b2)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>K8s disponible mais aucun cluster retourné.</p>
        </div>
      )}

      {!loading && clusters.map(cluster => {
        const h = HEALTH[cluster.health] || HEALTH.healthy;
        const isExp = expanded === cluster.id;
        const healthPct = cluster.stats.pods_total > 0 ? Math.round((cluster.stats.pods_healthy / cluster.stats.pods_total) * 100) : 100;
        return (
          <div key={cluster.id} style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
            {/* Main row */}
            <div onClick={() => setExpanded(isExp ? null : cluster.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "var(--s1)", cursor: "pointer", transition: "background 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cluster.provider.color}12`, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: cluster.provider.color, flexShrink: 0 }}>{PROV[cluster.provider.id] || "K8s"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>{cluster.name}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: h.color, background: `${h.color}08` }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} /> {h.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 12, color: "var(--t3)" }}>
                  <span>{cluster.provider.name}</span><span>{cluster.region}</span><span>{cluster.k8s_version}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                {[{ v: cluster.node_count, l: "nodes" }, { v: cluster.stats.pods_total, l: "pods" }, { v: `${healthPct}%`, l: "santé", c: healthPct === 100 ? "var(--g)" : "var(--am)" }].map(s => (
                  <div key={s.l} style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: (s as any).c || "var(--t1)" }}>{s.v}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{s.l}</div></div>
                ))}
              </div>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ transition: "transform 0.15s", transform: isExp ? "rotate(180deg)" : "none", flexShrink: 0 }}><path d="M4 6l4 4 4-4"/></svg>
            </div>
            {/* Health bar */}
            <div style={{ padding: "0 20px", background: "var(--s1)" }}><div style={{ height: 3, background: "var(--s3)", borderRadius: 2 }}><div style={{ height: "100%", borderRadius: 2, width: `${healthPct}%`, background: healthPct === 100 ? "var(--g)" : healthPct > 50 ? "var(--am)" : "var(--re)", transition: "width 0.5s" }} /></div></div>
            {/* Expanded */}
            {isExp && (
              <div style={{ padding: "20px", background: "var(--s1)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Informations</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 8, overflow: "hidden" }}>
                      {[["Contexte", cluster.context], ["Provider", cluster.provider.name], ["Région", cluster.region], ["Version K8s", cluster.k8s_version], ["Nodes", String(cluster.node_count)], ["Namespace surveillé", cluster.watched_namespace]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "var(--s2)" }}>
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>{k}</span><span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Pods ({cluster.watched_namespace})</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px", background: "var(--s2)", borderRadius: 8 }}>
                      {[{ l: "Total", v: cluster.stats.pods_total, c: "var(--t1)" }, { l: "Healthy", v: cluster.stats.pods_healthy, c: "var(--g)" }, { l: "Unhealthy", v: cluster.stats.pods_unhealthy, c: "var(--re)" }, { l: "Restarts", v: cluster.stats.total_restarts, c: "var(--am)" }].map(s => (
                        <div key={s.l} style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{s.l}</div></div>
                      ))}
                    </div>
                  </div>
                </div>
                {cluster.namespaces.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 8 }}>Namespaces</h4>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {cluster.namespaces.map(ns => (
                        <span key={ns} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, color: ns === cluster.watched_namespace ? "var(--t1)" : "var(--t3)", background: ns === cluster.watched_namespace ? "var(--s3)" : "var(--s2)", fontWeight: ns === cluster.watched_namespace ? 600 : 400 }}>{ns}</span>
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