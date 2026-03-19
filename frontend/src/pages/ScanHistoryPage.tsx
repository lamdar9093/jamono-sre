import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Scan {
  id: number;
  namespace: string;
  trigger: string;
  total_pods: number;
  healthy: number;
  unhealthy: number;
  incidents_created: number;
  details_json: string | null;
  scanned_at: string;
}

interface PodDetail {
  pod: string;
  severity: string;
  restarts: number;
  diagnostic: string | null;
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const SEV_COLOR: Record<string, string> = {
  critical: "#C13434",
  high: "#D85A30",
  medium: "#B87514",
  low: "#2D8B5F",
};

const TRIGGER_LABEL: Record<string, { label: string; color: string }> = {
  manual:    { label: "Manuel", color: "var(--brand)" },
  auto:      { label: "Auto", color: "var(--bl)" },
  scheduled: { label: "Planifié", color: "var(--purple)" },
};

export default function ScanHistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterTrigger, setFilterTrigger] = useState<string>("all");

  const fetchScans = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/monitor/scans?limit=50`);
      setScans(res.data.scans || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchScans(); }, []);

  const filtered = filterTrigger === "all" ? scans : scans.filter(s => s.trigger === filterTrigger);

  const totalScans = scans.length;
  const totalUnhealthy = scans.reduce((acc, s) => acc + s.unhealthy, 0);
  const totalIncidents = scans.reduce((acc, s) => acc + s.incidents_created, 0);
  const avgPods = scans.length > 0 ? Math.round(scans.reduce((acc, s) => acc + s.total_pods, 0) / scans.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Historique des scans</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>
            {totalScans} scan{totalScans !== 1 ? "s" : ""} enregistré{totalScans !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={fetchScans} style={{
          padding: "6px 14px", borderRadius: "var(--r)",
          fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--b2)",
          background: "transparent", color: "var(--t2)",
          transition: "all 0.12s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
        >↻ Rafraîchir</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Total scans", val: totalScans, color: "var(--t1)" },
          { label: "Pods moyen", val: avgPods, color: "var(--bl)" },
          { label: "Problèmes détectés", val: totalUnhealthy, color: totalUnhealthy > 0 ? "var(--re)" : "var(--g)" },
          { label: "Incidents créés", val: totalIncidents, color: "var(--brand)" },
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

      {/* Filters */}
      <div style={{ display: "flex", gap: 4 }}>
        {[{ k: "all", l: "Tous" }, { k: "manual", l: "Manuels" }, { k: "auto", l: "Automatiques" }, { k: "scheduled", l: "Planifiés" }].map(f => (
          <button key={f.k} onClick={() => setFilterTrigger(f.k)} style={{
            padding: "5px 14px", borderRadius: "var(--r)", fontFamily: "var(--fm)", fontSize: 11,
            cursor: "pointer", border: filterTrigger === f.k ? "1px solid var(--brand-b)" : "1px solid transparent",
            background: filterTrigger === f.k ? "var(--brand-a)" : "transparent",
            color: filterTrigger === f.k ? "var(--brand)" : "var(--t3)",
            fontWeight: filterTrigger === f.k ? 600 : 400,
          }}>{f.l}</button>
        ))}
      </div>

      {/* Scan list */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "50px 1fr 90px 80px 80px 80px 100px",
          padding: "8px 16px", gap: 10, borderBottom: "1px solid var(--b1)", alignItems: "center",
        }}>
          {["#", "Date", "Namespace", "Pods", "Sains", "Problèmes", "Trigger"].map(h => (
            <span key={h} style={{
              fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)",
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
            }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun scan enregistré</p>
          </div>
        ) : (
          filtered.map(scan => {
            const isExpanded = expandedId === scan.id;
            const trigger = TRIGGER_LABEL[scan.trigger] || TRIGGER_LABEL.manual;
            let details: PodDetail[] = [];
            if (scan.details_json) {
              try { details = JSON.parse(scan.details_json); } catch (e) {}
            }

            return (
              <div key={scan.id}>
                {/* Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "50px 1fr 90px 80px 80px 80px 100px",
                    padding: "10px 16px", gap: 10, alignItems: "center",
                    borderBottom: "0.5px solid var(--b1)",
                    cursor: "pointer", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>#{scan.id}</span>
                  <div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", fontWeight: 500 }}>
                      {fmtDate(scan.scanned_at)}
                    </div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 1 }}>
                      {timeAgo(scan.scanned_at)}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)" }}>{scan.namespace}</span>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", fontWeight: 600 }}>{scan.total_pods}</span>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--g)", fontWeight: 600 }}>{scan.healthy}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {scan.unhealthy > 0 && (
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--re)" }} />
                    )}
                    <span style={{
                      fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600,
                      color: scan.unhealthy > 0 ? "var(--re)" : "var(--g)",
                    }}>{scan.unhealthy}</span>
                  </div>
                  <span style={{
                    fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600,
                    color: trigger.color, background: `${trigger.color}12`,
                    padding: "2px 8px", borderRadius: 5,
                    display: "inline-block", textAlign: "center",
                  }}>{trigger.label}</span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: "14px 16px 14px 66px",
                    background: "var(--s2)", borderBottom: "1px solid var(--b1)",
                  }}>
                    {details.length === 0 ? (
                      <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
                        {scan.unhealthy === 0 ? "Aucun problème détecté lors de ce scan" : "Détails non disponibles"}
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                          Pods problématiques
                        </span>
                        {details.map((d, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 14px", borderRadius: 8,
                            background: "var(--s1)", border: "0.5px solid var(--b1)",
                          }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                              background: SEV_COLOR[d.severity] || "var(--re)",
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600, color: "var(--t1)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{d.pod}</div>
                              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                                {d.restarts} restart{d.restarts !== 1 ? "s" : ""}
                                {d.diagnostic && d.diagnostic !== "None" && (
                                  <span style={{ marginLeft: 8, color: "var(--t2)" }}>
                                    {d.diagnostic.split(":")[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span style={{
                              fontFamily: "var(--fm)", fontSize: 9, fontWeight: 700,
                              color: SEV_COLOR[d.severity] || "var(--re)",
                              background: `${SEV_COLOR[d.severity] || "var(--re)"}10`,
                              padding: "2px 8px", borderRadius: 5,
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>{d.severity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {scan.incidents_created > 0 && (
                      <div style={{
                        marginTop: 10, display: "flex", alignItems: "center", gap: 6,
                        fontFamily: "var(--fm)", fontSize: 11, color: "var(--brand)",
                      }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2L6 10l-4-4"/>
                        </svg>
                        {scan.incidents_created} incident{scan.incidents_created > 1 ? "s" : ""} créé{scan.incidents_created > 1 ? "s" : ""} depuis ce scan
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}