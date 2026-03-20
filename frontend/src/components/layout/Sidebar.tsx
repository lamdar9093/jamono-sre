import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";

interface OnCall { name: string; slack_username: string | null; }

const PROVIDERS: Record<string, { short: string; color: string }> = {
  eks: { short: "EKS", color: "var(--aws)" }, aks: { short: "AKS", color: "var(--azure)" },
  gke: { short: "GKE", color: "var(--gcp)" }, rke: { short: "RKE", color: "var(--rancher)" },
  k3s: { short: "K3s", color: "var(--k3s)" },
};

const CLUSTERS = [
  { id: "local-k3s", name: "k3d-local", provider: "k3s", region: "Local", status: "healthy" },
];

const NAV = [
  {
    section: "Infrastructure",
    links: [
      { path: "/", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="1.5" y="1.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="1.5" width="5" height="3" rx="1.2"/><rect x="9.5" y="7" width="5" height="7.5" rx="1.2"/><rect x="1.5" y="9" width="5" height="5.5" rx="1.2"/></svg> },
      { path: "/clusters", label: "Clusters", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="1" y="1.5" width="14" height="5" rx="1.5"/><rect x="1" y="9.5" width="14" height="5" rx="1.5"/><circle cx="4" cy="4" r="0.9" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none"/></svg> },
    ]
  },
  {
    section: "Incidents",
    links: [
      { path: "/incidents", label: "Incidents", badge: true, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 2L14 13H2L8 2z"/><path d="M8 7v2.5M8 11.5v.5"/></svg> },
      { path: "/history", label: "Historique", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg> },
      { path: "/scans", label: "Scans", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M14.5 8A6.5 6.5 0 101.5 8"/><path d="M14.5 8l-2.2-2.2M14.5 8l-2.2 2.2"/></svg> },
    ]
  },
  {
    section: "Configuration",
    links: [
      { path: "/settings", label: "Paramètres", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/></svg> },
      { path: "/integrations", label: "Intégrations", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6.5 9.5a3.5 3.5 0 005.3.4l2-2a3.5 3.5 0 00-5-5l-1.2 1.2"/><path d="M9.5 6.5a3.5 3.5 0 00-5.3-.4l-2 2a3.5 3.5 0 005 5l1.2-1.2"/></svg> },
      { path: "/team", label: "Équipe", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="6" cy="5" r="2.3"/><path d="M1.5 14a4.5 4.5 0 019 0"/><circle cx="12" cy="7" r="1.8"/><path d="M14.5 13.5a2.5 2.5 0 00-5 0"/></svg> },
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [oncall, setOncall] = useState<OnCall | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [clusterOpen, setClusterOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(CLUSTERS[0]);

  useEffect(() => {
    axios.get(`${API_URL}/team`).then(r => setOncall(r.data.oncall)).catch(() => {});
    axios.get(`${API_URL}/incidents`).then(r => {
      setOpenIncidents(r.data.incidents?.filter((i: any) => i.status !== "resolved").length || 0);
    }).catch(() => {});
  }, []);

  const p = PROVIDERS[selectedCluster.provider];

  return (
    <aside style={{ background: "var(--sidebar)", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "sticky", top: 0 }}>

      {/* Logo */}
      <div onClick={() => navigate("/")} style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, cursor: "pointer", transition: "opacity 0.15s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: 5, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C15F3C" }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C15F3C", opacity: 0.55 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C15F3C", opacity: 0.55 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22A06B" }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22A06B", opacity: 0.55 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22A06B", opacity: 0.55 }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22A06B" }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", letterSpacing: "0.06em" }}>Jamono</div>
      </div>

      {/* Cluster switcher */}
      <div style={{ padding: "0 10px", marginBottom: 6, position: "relative" }}>
        <button onClick={() => setClusterOpen(!clusterOpen)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", background: "var(--sidebar2)",
          border: `1px solid ${clusterOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 8, cursor: "pointer", color: "#fff",
        }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: `${p?.color}20`, display: "grid", placeItems: "center", fontSize: 7, fontWeight: 800, color: p?.color, flexShrink: 0 }}>{p?.short}</div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{selectedCluster.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{p?.short} · {selectedCluster.region}</div>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g)", flexShrink: 0 }} />
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4"/></svg>
        </button>

        {clusterOpen && (
          <div style={{ position: "absolute", top: "100%", left: 10, right: 10, background: "var(--sidebar2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", zIndex: 50, marginTop: 4, overflow: "hidden" }}>
            <div style={{ padding: "8px 10px 4px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Changer de cluster</div>
            {CLUSTERS.map(cl => {
              const cp = PROVIDERS[cl.provider];
              const active = cl.id === selectedCluster.id;
              return (
                <button key={cl.id} onClick={() => { setSelectedCluster(cl); setClusterOpen(false); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  border: "none", cursor: "pointer", background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "#fff", textAlign: "left", transition: "background 0.1s",
                }} onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                   onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: `${cp?.color}20`, display: "grid", placeItems: "center", fontSize: 7, fontWeight: 800, color: cp?.color }}>{cp?.short}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{cl.name}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{cp?.short} · {cl.region}</div></div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cl.status === "healthy" ? "var(--g)" : "var(--re)" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "12px 10px 4px", display: "block", fontWeight: 600 }}>{group.section}</span>
            {group.links.map(link => {
              const active = location.pathname === link.path;
              return (
                <div key={link.path} onClick={() => { navigate(link.path); setClusterOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8,
                  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  transition: "all 0.12s", userSelect: "none",
                }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; } }}>
                  <span style={{ opacity: active ? 1 : 0.5, flexShrink: 0, display: "flex" }}>{link.icon}</span>
                  {link.label}
                  {(link as any).badge && openIncidents > 0 && (
                    <span style={{ marginLeft: "auto", background: "var(--re)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10, minWidth: 18, textAlign: "center" }}>{openIncidents}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* On-call */}
      <div style={{ padding: "10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {oncall ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,160,107,0.15)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "var(--g)", flexShrink: 0 }}>
              {oncall.name.charAt(0).toUpperCase()}{oncall.name.split(" ")[1]?.charAt(0).toUpperCase() || ""}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{oncall.name}</div>
              <div style={{ fontSize: 10, color: "var(--g)", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)" }} />
                On-call
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "10px", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Aucun on-call</div>
        )}
      </div>
    </aside>
  );
}