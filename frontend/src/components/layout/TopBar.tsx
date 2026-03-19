import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../../config";

const routeLabels: Record<string, string> = {
  "/": "dashboard",
  "/clusters": "clusters",
  "/incidents": "incidents",
  "/history": "historique",
  "/settings": "paramètres",
  "/team": "équipe",
  "/integrations": "intégrations",
  "/scans": "scans",
};

interface LastScan {
  id: number;
  namespace: string;
  trigger: string;
  total_pods: number;
  healthy: number;
  unhealthy: number;
  scanned_at: string;
  incidents_created?: number;
}

interface Notif {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICON: Record<string, { color: string; icon: string }> = {
  incident_created: { color: "var(--re)", icon: "!" },
  scan_complete:    { color: "var(--am)", icon: "↻" },
  remediation:      { color: "var(--g)", icon: "✓" },
  slack_message:    { color: "#E01E5A", icon: "S" },
  jira_update:      { color: "#0052CC", icon: "J" },
  default:          { color: "var(--bl)", icon: "•" },
};

export default function TopBar({ onDeclareIncident, scanRefresh }: { onDeclareIncident?: () => void; scanRefresh?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [scanHistory, setScanHistory] = useState<LastScan[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Notifications state
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const page = routeLabels[location.pathname] || "jamono";

  // Fetch last scan
  const fetchLastScan = () => {
    axios.get(`${API_URL}/monitor/scans/last`).then(r => {
      setLastScan(r.data.scan || null);
    }).catch(() => {});
  };

  // Fetch unread count
  const fetchUnreadCount = () => {
    axios.get(`${API_URL}/notifications?limit=1&unread_only=true`).then(r => {
      setUnreadCount(r.data.unread_count || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchLastScan();
    fetchUnreadCount();
    const interval = setInterval(() => { fetchLastScan(); fetchUnreadCount(); }, 15000);
    return () => clearInterval(interval);
  }, [scanRefresh]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openHistory = async () => {
    setShowNotifs(false);
    setShowScanHistory(!showScanHistory);
    if (!showScanHistory) {
      setLoadingHistory(true);
      try {
        const res = await axios.get(`${API_URL}/monitor/scans?limit=5`);
        setScanHistory(res.data.scans || []);
      } catch (e) { console.error(e); }
      finally { setLoadingHistory(false); }
    }
  };

  const openNotifs = async () => {
    setShowScanHistory(false);
    setShowNotifs(!showNotifs);
    if (!showNotifs) {
      setLoadingNotifs(true);
      try {
        const res = await axios.get(`${API_URL}/notifications?limit=15`);
        setNotifs(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      } catch (e) { console.error(e); }
      finally { setLoadingNotifs(false); }
    }
  };

  const markAllRead = async () => {
    try {
      await axios.post(`${API_URL}/notifications/read`);
      setUnreadCount(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) { console.error(e); }
  };

  const markOneRead = async (notif: Notif) => {
    if (!notif.is_read) {
      try {
        await axios.post(`${API_URL}/notifications/${notif.id}/read`);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) { console.error(e); }
    }
    if (notif.link) {
      navigate(notif.link);
      setShowNotifs(false);
    }
  };

  const formatScanTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "il y a quelques secondes";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const formatNotifTime = (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}j`;
  };

  return (
    <div style={{
      height: 48, background: "var(--s1)", borderBottom: "1px solid var(--b1)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 22px", flexShrink: 0, gap: 12,
    }}>
      {/* Left — Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 4,
          background: "var(--k3s)18", border: "1px solid var(--k3s)30",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--fm)", fontSize: 7, fontWeight: 800, color: "var(--k3s)",
        }}>K3s</div>

        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: "var(--t2)" }}>k3d-local</span>
          <span style={{ color: "var(--b3)" }}>/</span>
          <span style={{ color: "var(--t1)", fontWeight: 600 }}>{page}</span>
        </div>

        <div style={{ width: 1, height: 16, background: "var(--b2)" }} />

        {/* Last scan — clickable */}
        <div style={{ position: "relative" }}>
          <button onClick={openHistory} style={{
            fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)",
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6, transition: "all 0.12s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
          >
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: lastScan ? (lastScan.unhealthy > 0 ? "var(--am)" : "var(--g)") : "var(--t3)",
              boxShadow: lastScan ? `0 0 4px ${lastScan.unhealthy > 0 ? "var(--am)" : "var(--g)"}` : "none",
            }} />
            {lastScan ? `${formatScanTime(lastScan.scanned_at)} · ${lastScan.total_pods} pods` : "aucun scan"}
            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </button>

          {/* Scan history dropdown */}
          {showScanHistory && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 4,
              width: 340, background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              zIndex: 100, overflow: "hidden",
            }}>
              <div style={{
                padding: "10px 14px", borderBottom: "1px solid var(--b1)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600, color: "var(--t1)" }}>Historique des scans</span>
                <button onClick={() => setShowScanHistory(false)} style={{
                  background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 14,
                }}>×</button>
              </div>
              {loadingHistory ? (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</span>
                </div>
              ) : scanHistory.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun scan enregistré</span>
                </div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {scanHistory.map(scan => (
                    <div key={scan.id} style={{
                      padding: "10px 14px", borderBottom: "0.5px solid var(--b1)",
                      display: "flex", alignItems: "center", gap: 10, transition: "background 0.1s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: scan.unhealthy > 0 ? "var(--re)" : "var(--g)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", fontWeight: 500 }}>
                          {scan.total_pods} pods · {scan.healthy} sains · {scan.unhealthy} problème{scan.unhealthy !== 1 ? "s" : ""}
                        </div>
                        <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>
                          {formatScanTime(scan.scanned_at)} · {scan.trigger} · {scan.namespace}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "10px 14px", borderTop: "1px solid var(--b1)", textAlign: "center" }}>
                    <a href="/scans" onClick={() => setShowScanHistory(false)} style={{
                      fontFamily: "var(--fm)", fontSize: 11, color: "var(--brand)",
                      textDecoration: "none", fontWeight: 500,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}>
                      Voir tout l'historique
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 3h7v7M13 3L6 10"/>
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right — Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => { if (onDeclareIncident) onDeclareIncident(); else navigate("/incidents"); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: "var(--r)",
            fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
            cursor: "pointer", border: "none",
            background: "var(--brand)", color: "#fff",
            boxShadow: "0 2px 10px rgba(193,95,60,0.25)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(193,95,60,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(193,95,60,0.25)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
          </svg>
          Déclarer un incident
        </button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={openNotifs}
            style={{
              width: 34, height: 34, borderRadius: "var(--r)",
              border: `1px solid ${showNotifs ? "var(--brand-b)" : "var(--b2)"}`,
              background: showNotifs ? "var(--brand-a)" : "transparent",
              color: showNotifs ? "var(--brand)" : "var(--t2)",
              display: "grid", placeItems: "center",
              cursor: "pointer", position: "relative", transition: "all 0.12s",
            }}
            onMouseEnter={e => { if (!showNotifs) { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; } }}
            onMouseLeave={e => { if (!showNotifs) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; } }}
          >
            {unreadCount > 0 && (
              <div style={{
                position: "absolute", top: 3, right: 3,
                minWidth: 14, height: 14, borderRadius: 7,
                background: "var(--re)", color: "#fff",
                fontFamily: "var(--fm)", fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px", border: "1.5px solid var(--s1)",
              }}>{unreadCount > 9 ? "9+" : unreadCount}</div>
            )}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M8 2a5 5 0 015 5v3.5l1 2H2l1-2V7a5 5 0 015-5zM6.5 13.5a1.5 1.5 0 003 0"/>
            </svg>
          </button>

          {/* Notifications dropdown */}
          {showNotifs && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4,
              width: 380, background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              zIndex: 100, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--b1)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span style={{
                      fontFamily: "var(--fm)", fontSize: 9, fontWeight: 700,
                      color: "var(--re)", background: "var(--re-a)",
                      padding: "1px 6px", borderRadius: 8,
                    }}>{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{
                    fontFamily: "var(--fm)", fontSize: 10, color: "var(--brand)",
                    background: "none", border: "none", cursor: "pointer",
                  }}>Tout marquer comme lu</button>
                )}
              </div>

              {/* List */}
              {loadingNotifs ? (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</span>
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--b3)" strokeWidth="1.2" strokeLinecap="round" style={{ margin: "0 auto 8px" }}>
                    <path d="M8 2a5 5 0 015 5v3.5l1 2H2l1-2V7a5 5 0 015-5zM6.5 13.5a1.5 1.5 0 003 0"/>
                  </svg>
                  <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucune notification</p>
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {notifs.map(notif => {
                    const ni = NOTIF_ICON[notif.type] || NOTIF_ICON.default;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => markOneRead(notif)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "0.5px solid var(--b1)",
                          display: "flex", gap: 10, cursor: notif.link ? "pointer" : "default",
                          background: notif.is_read ? "transparent" : `${ni.color}04`,
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = notif.is_read ? "transparent" : `${ni.color}04`; }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: `${ni.color}10`, border: `1px solid ${ni.color}20`,
                          display: "grid", placeItems: "center",
                          fontFamily: "var(--fm)", fontSize: 11, fontWeight: 700, color: ni.color,
                        }}>{ni.icon}</div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              fontFamily: "var(--f)", fontSize: 12,
                              fontWeight: notif.is_read ? 400 : 600,
                              color: notif.is_read ? "var(--t2)" : "var(--t1)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                            }}>{notif.title}</span>
                            <span style={{
                              fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", flexShrink: 0,
                            }}>{formatNotifTime(notif.created_at)}</span>
                          </div>
                          {notif.detail && (
                            <p style={{
                              fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)",
                              marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{notif.detail}</p>
                          )}
                        </div>

                        {/* Unread dot */}
                        {!notif.is_read && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: ni.color, flexShrink: 0, alignSelf: "center",
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}