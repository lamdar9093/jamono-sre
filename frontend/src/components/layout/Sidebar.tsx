import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";

interface OnCall {
  name: string;
  slack_username: string | null;
}

// ── Provider configs for multi-cloud ──
const PROVIDERS: Record<string, { label: string; short: string; color: string }> = {
  eks:  { label: "Amazon EKS",  short: "EKS",  color: "var(--aws)" },
  aks:  { label: "Azure AKS",   short: "AKS",  color: "var(--azure)" },
  gke:  { label: "Google GKE",  short: "GKE",  color: "var(--gcp)" },
  rke:  { label: "Rancher RKE", short: "RKE",  color: "var(--rancher)" },
  k3s:  { label: "K3s",         short: "K3s",  color: "var(--k3s)" },
};

// TODO: Replace with real data from API
const CLUSTERS = [
  { id: "local-k3s", name: "k3d-local", provider: "k3s", region: "Local", status: "healthy" },
  // When you add multi-cluster to your backend, add more here
];

// ── Nav structure (restructured for Incident Management) ──
const navItems = [
  {
    section: "Infrastructure",
    links: [
      {
        path: "/", label: "Dashboard",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="1.5" y="1.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="1.5" width="5" height="3" rx="1.2"/>
            <rect x="9.5" y="7" width="5" height="7.5" rx="1.2"/><rect x="1.5" y="9" width="5" height="5.5" rx="1.2"/>
          </svg>
        )
      },
      {
        path: "/clusters", label: "Clusters",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="1" y="1.5" width="14" height="5" rx="1.5"/><rect x="1" y="9.5" width="14" height="5" rx="1.5"/>
            <circle cx="4" cy="4" r="0.9" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none"/>
          </svg>
        )
      },
    ]
  },
  {
    section: "Incident Management",
    links: [
      {
        path: "/incidents", label: "Incidents", badge: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 2L14 13H2L8 2z"/><path d="M8 7v2.5M8 11.5v.5"/>
          </svg>
        )
      },
      {
        path: "/history", label: "Historique",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>
          </svg>
        )
      },
    ]
  },
  {
    section: "Configuration",
    links: [
      {
        path: "/settings", label: "Paramètres",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.2"/>
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/>
          </svg>
        )
      },
      {
        path: "/integrations", label: "Intégrations",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M6.5 9.5a3.5 3.5 0 005.3.4l2-2a3.5 3.5 0 00-5-5l-1.2 1.2"/>
            <path d="M9.5 6.5a3.5 3.5 0 00-5.3-.4l-2 2a3.5 3.5 0 005 5l1.2-1.2"/>
          </svg>
        )
      },
      {
        path: "/team", label: "Équipe",
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="6" cy="5" r="2.3"/><path d="M1.5 14a4.5 4.5 0 019 0"/>
            <circle cx="12" cy="7" r="1.8"/><path d="M14.5 13.5a2.5 2.5 0 00-5 0"/>
          </svg>
        )
      },
    ]
  }
];

function ProviderBadge({ provider, size = 22 }: { provider: string; size?: number }) {
  const p = PROVIDERS[provider];
  if (!p) return null;
  const letters: Record<string, string> = { eks: "AWS", aks: "AZ", gke: "GC", rke: "RKE", k3s: "K3s" };
  return (
    <div style={{
      width: size, height: size, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
      background: `${p.color}18`, border: `1px solid ${p.color}30`,
      fontSize: size < 22 ? 7 : 8, fontWeight: 800, color: p.color, letterSpacing: "-0.02em",
      fontFamily: "var(--fm)", flexShrink: 0,
    }}>
      {letters[provider]}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [oncall, setOncall] = useState<OnCall | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [clusterDropdown, setClusterDropdown] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(CLUSTERS[0]);

  // ── Existing API calls — untouched ──
  useEffect(() => {
    axios.get(`${API_URL}/team`).then(r => setOncall(r.data.oncall)).catch(() => {});
    axios.get(`${API_URL}/incidents`).then(r => {
      const open = r.data.incidents?.filter((i: any) => i.status !== "resolved").length || 0;
      setOpenIncidents(open);
    }).catch(() => {});
  }, []);

  return (
    <aside style={{
      background: "var(--sidebar)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      position: "sticky",
      top: 0,
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30,
          background: "linear-gradient(135deg, var(--brand), #DA7756)",
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(193,95,60,0.3)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>J</span>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--st1)", letterSpacing: "-0.02em" }}>jamono</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--st3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>SRE Copilot</div>
        </div>
      </div>

      {/* ── Cluster Switcher ── */}
      <div style={{ padding: "10px 12px 0", position: "relative" }}>
        <button
          onClick={() => setClusterDropdown(!clusterDropdown)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: "var(--sidebar2)",
            border: `1px solid ${clusterDropdown ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: "var(--r)",
            cursor: "pointer",
            transition: "border-color 0.15s",
            color: "var(--st1)",
          }}
        >
          <ProviderBadge provider={selectedCluster.provider} size={22} />
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{selectedCluster.name}</div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--st3)", marginTop: 1 }}>
              {PROVIDERS[selectedCluster.provider]?.short} · {selectedCluster.region}
            </div>
          </div>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: selectedCluster.status === "healthy" ? "var(--g)" : selectedCluster.status === "warning" ? "var(--am)" : "var(--re)",
            boxShadow: `0 0 6px ${selectedCluster.status === "healthy" ? "var(--g)" : "var(--re)"}50`,
          }} />
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--st3)" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </button>

        {/* Dropdown */}
        {clusterDropdown && (
          <div style={{
            position: "absolute", top: "100%", left: 12, right: 12,
            background: "var(--sidebar2)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--r)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            zIndex: 50, marginTop: 4, overflow: "hidden",
            animation: "scaleIn 0.15s ease",
          }}>
            <div style={{
              padding: "8px 10px 5px",
              fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
              color: "var(--st3)", textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              Changer de cluster
            </div>
            {CLUSTERS.map(cl => {
              const isActive = cl.id === selectedCluster.id;
              return (
                <button
                  key={cl.id}
                  onClick={() => { setSelectedCluster(cl); setClusterDropdown(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 10px", border: "none", cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    color: "var(--st1)", textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <ProviderBadge provider={cl.provider} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 11, fontWeight: 500, color: "var(--st1)" }}>{cl.name}</div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--st3)" }}>
                      {PROVIDERS[cl.provider]?.short} · {cl.region}
                    </div>
                  </div>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: cl.status === "healthy" ? "var(--g)" : "var(--re)",
                  }} />
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 4 6 11 3 8"/>
                    </svg>
                  )}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6px 10px" }}>
              <button style={{
                width: "100%", padding: "7px", borderRadius: 6,
                background: "transparent", border: "1px dashed rgba(255,255,255,0.12)",
                color: "var(--st3)", cursor: "pointer",
                fontFamily: "var(--fm)", fontSize: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                + Ajouter un cluster
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {navItems.map((group) => (
          <div key={group.section} style={{ marginBottom: 2 }}>
            <span style={{
              fontFamily: "var(--fm)",
              fontSize: 9,
              color: "var(--st3)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "10px 10px 4px",
              display: "block",
              fontWeight: 600,
            }}>
              {group.section}
            </span>
            {group.links.map((link) => {
              const active = location.pathname === link.path;
              return (
                <div
                  key={link.path}
                  onClick={() => { navigate(link.path); setClusterDropdown(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 10px",
                    borderRadius: "var(--r)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 600 : 450,
                    color: active ? "#fff" : "var(--st2)",
                    background: active ? "rgba(255,255,255,0.1)" : "transparent",
                    border: "1px solid transparent",
                    transition: "all 0.12s",
                    userSelect: "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--st2)";
                    }
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.55, flexShrink: 0, display: "flex" }}>
                    {link.icon}
                  </span>
                  {link.label}
                  {link.badge && openIncidents > 0 && (
                    <span style={{
                      marginLeft: "auto",
                      background: "var(--re)",
                      color: "#fff",
                      fontFamily: "var(--fm)",
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 10,
                      minWidth: 18,
                      textAlign: "center",
                    }}>
                      {openIncidents}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── On-call ── */}
      <div style={{ padding: "10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {oncall ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 10px",
            background: "rgba(45,139,95,0.1)",
            border: "1px solid rgba(45,139,95,0.15)",
            borderRadius: "var(--r)",
          }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: 7,
              background: "rgba(45,139,95,0.2)",
              border: "2px solid rgba(45,139,95,0.3)",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#34D399",
              flexShrink: 0,
            }}>
              {oncall.name.charAt(0).toUpperCase()}{oncall.name.split(" ")[1]?.charAt(0).toUpperCase() || ""}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--st1)", lineHeight: 1.2 }}>
                {oncall.name}
              </div>
              <div style={{
                fontFamily: "var(--fm)", fontSize: 9, color: "#34D399",
                letterSpacing: "0.06em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 4, marginTop: 2,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#34D399",
                  boxShadow: "0 0 4px #34D399",
                }}/>
                ON-CALL
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: "9px 10px",
            background: "var(--sidebar2)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--r)",
            fontFamily: "var(--fm)",
            fontSize: 10,
            color: "var(--st3)",
          }}>
            Aucun on-call
          </div>
        )}
      </div>
    </aside>
  );
}