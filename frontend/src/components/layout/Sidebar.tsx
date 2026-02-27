import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";

interface OnCall {
  name: string;
  slack_username: string | null;
}

const navItems = [
  {
    section: "Monitoring",
    links: [
      {
        path: "/", label: "Dashboard",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/>
            <rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/>
          </svg>
        )
      },
      {
        path: "/clusters", label: "Clusters",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 3.5h10M2 7h10M2 10.5h10"/>
            <circle cx="2" cy="3.5" r="0.8" fill="currentColor" stroke="none"/>
            <circle cx="2" cy="7" r="0.8" fill="currentColor" stroke="none"/>
            <circle cx="2" cy="10.5" r="0.8" fill="currentColor" stroke="none"/>
          </svg>
        )
      },
    ]
  },
  {
    section: "Incidents",
    links: [
      {
        path: "/incidents", label: "Incidents", badge: true,
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M7 2L12 11H2L7 2z"/><path d="M7 6.5v2M7 10v.5"/>
          </svg>
        )
      },
      {
        path: "/history", label: "Historique",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7" cy="7" r="5"/><path d="M7 4.5V7l2 1.5"/>
          </svg>
        )
      },
    ]
  },
  {
    section: "Config",
    links: [
      {
        path: "/settings", label: "Paramètres",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7" cy="7" r="2"/>
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4"/>
          </svg>
        )
      },
      {
        path: "/connectors", label: "Connecteurs",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="4" cy="4" r="2"/><circle cx="10" cy="10" r="2"/>
            <path d="M6 4h2a2 2 0 012 2v2"/>
          </svg>
        )
      },
      {
        path: "/team", label: "Équipe",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="5" cy="4.5" r="2"/><path d="M1 12a4 4 0 018 0"/>
            <circle cx="11" cy="7" r="1.8"/><path d="M13 11a2 2 0 00-4 0"/>
          </svg>
        )
      },
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [oncall, setOncall] = useState<OnCall | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);

  useEffect(() => {
    axios.get(`${API_URL}/team`).then(r => setOncall(r.data.oncall)).catch(() => {});
    axios.get(`${API_URL}/incidents`).then(r => {
      const open = r.data.incidents?.filter((i: any) => i.status === "open" || i.status === "in_progress").length || 0;
      setOpenIncidents(open);
    }).catch(() => {});
  }, []);

  return (
    <aside style={{
      background: "var(--s1)",
      borderRight: "1px solid var(--b1)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      position: "sticky",
      top: 0,
    }}>

      {/* Logo */}
      <div style={{
        padding: "13px 12px 12px",
        borderBottom: "1px solid var(--b1)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
      }}>
        <div style={{
          width: 24, height: 24,
          background: "var(--jam)",
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="2.5" stroke="white" strokeWidth="1.4"/>
            <circle cx="8" cy="2" r="1" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.02em" }}>jamono</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 8.5, color: "var(--t3)", letterSpacing: "0.06em" }}>sre copilot</div>
        </div>
      </div>

      {/* Cluster */}
      <div style={{
        margin: "8px 8px 0",
        padding: "6px 9px",
        background: "var(--s2)",
        border: "1px solid var(--b2)",
        borderRadius: "var(--r)",
        display: "flex",
        alignItems: "center",
        gap: 7,
        cursor: "pointer",
        flexShrink: 0,
      }}>
        <div style={{
          width: 5, height: 5,
          background: "var(--g)",
          borderRadius: "50%",
          flexShrink: 0,
          boxShadow: "0 0 0 3px var(--g-a)",
        }} />
        <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", flex: 1 }}>
          k3d-local
        </span>
        <span style={{ color: "var(--t3)", fontSize: 10 }}>⌄</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 6px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {navItems.map((group) => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <span style={{
              fontFamily: "var(--fm)",
              fontSize: 9,
              color: "var(--t3)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "8px 8px 3px",
              display: "block",
            }}>
              {group.section}
            </span>
            {group.links.map((link) => {
              const active = location.pathname === link.path;
              return (
                <div
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: active ? "6px 8px 6px 6px" : "6px 8px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: active ? 500 : 400,
                    color: active ? "var(--t1)" : "var(--t2)",
                    background: active ? "var(--s2)" : "transparent",
                    borderLeft: active ? "2px solid var(--jam)" : "2px solid transparent",
                    transition: "all 0.1s",
                    userSelect: "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "var(--s2)";
                      (e.currentTarget as HTMLElement).style.color = "var(--t1)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--t2)";
                    }
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0, display: "flex" }}>
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
                      padding: "1px 5px",
                      borderRadius: 10,
                      minWidth: 16,
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

      {/* On-call */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--b1)", flexShrink: 0 }}>
        {oncall ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 9px",
            background: "var(--g-a)",
            border: "1px solid rgba(36,168,118,0.12)",
            borderRadius: "var(--r)",
          }}>
            <div style={{
              width: 20, height: 20,
              borderRadius: "50%",
              background: "var(--g)",
              display: "grid",
              placeItems: "center",
              fontSize: 8,
              fontWeight: 700,
              color: "#050705",
              flexShrink: 0,
            }}>
              {oncall.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--t1)", lineHeight: 1.2 }}>
                {oncall.name}
              </div>
              <div style={{ fontFamily: "var(--fm)", fontSize: 8, color: "var(--g)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                ● on-call
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: "7px 9px",
            background: "var(--s2)",
            border: "1px solid var(--b2)",
            borderRadius: "var(--r)",
            fontFamily: "var(--fm)",
            fontSize: 10,
            color: "var(--t3)",
          }}>
            Aucun on-call
          </div>
        )}
      </div>
    </aside>
  );
}