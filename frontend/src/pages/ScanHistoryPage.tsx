import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Scan { id: number; namespace: string; trigger: string; total_pods: number; healthy: number; unhealthy: number; incidents_created: number; details_json: string | null; scanned_at: string; }
interface PodDetail { pod: string; severity: string; restarts: number; diagnostic: string | null; }

function timeAgo(d: string) { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)}min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`; return `il y a ${Math.floor(s / 86400)}j`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const SEV_COLOR: Record<string, string> = { critical: "var(--sev-critical)", high: "var(--sev-high)", medium: "var(--sev-medium)", low: "var(--sev-low)" };
const TRIGGER: Record<string, { label: string; color: string }> = { manual: { label: "Manuel", color: "var(--t2)" }, auto: { label: "Auto", color: "var(--bl)" }, scheduled: { label: "Planifié", color: "var(--purple)" } };

export default function ScanHistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterTrigger, setFilterTrigger] = useState("all");

  const fetchScans = async () => { setLoading(true); try { const res = await axios.get(`${API_URL}/monitor/scans?limit=50`); setScans(res.data.scans || []); } catch (e) { console.error(e); } finally { setLoading(false); } };
  useEffect(() => { fetchScans(); }, []);

  const filtered = filterTrigger === "all" ? scans : scans.filter(s => s.trigger === filterTrigger);
  const totalUnhealthy = scans.reduce((a, s) => a + s.unhealthy, 0);
  const totalIncidents = scans.reduce((a, s) => a + s.incidents_created, 0);
  const avgPods = scans.length > 0 ? Math.round(scans.reduce((a, s) => a + s.total_pods, 0) / scans.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Historique des scans</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{scans.length} scan{scans.length !== 1 ? "s" : ""} enregistré{scans.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={fetchScans} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", transition: "all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}>Rafraîchir</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {[
          { label: "Total scans", val: scans.length, color: "var(--t1)" },
          { label: "Pods moyen", val: avgPods, color: "var(--bl)" },
          { label: "Problèmes détectés", val: totalUnhealthy, color: totalUnhealthy > 0 ? "var(--re)" : "var(--g)" },
          { label: "Incidents créés", val: totalIncidents, color: "var(--brand)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--s1)", padding: "20px 24px" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4 }}>
        {[{ k: "all", l: "Tous" }, { k: "manual", l: "Manuels" }, { k: "auto", l: "Auto" }, { k: "scheduled", l: "Planifiés" }].map(f => (
          <button key={f.k} onClick={() => setFilterTrigger(f.k)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "none",
            fontWeight: filterTrigger === f.k ? 600 : 400,
            background: filterTrigger === f.k ? "var(--t1)" : "transparent",
            color: filterTrigger === f.k ? "#fff" : "var(--t3)", transition: "all 0.12s",
          }}>{f.l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 90px 70px 70px 80px 90px", padding: "10px 18px", gap: 10, background: "var(--s2)", alignItems: "center" }}>
          {["#", "Date", "Namespace", "Pods", "Sains", "Problèmes", "Trigger"].map(h => (
            <span key={h} style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px 18px", textAlign: "center", background: "var(--s1)" }}><p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement...</p></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center", background: "var(--s1)" }}><p style={{ fontSize: 14, color: "var(--t3)" }}>Aucun scan enregistré</p></div>
        ) : filtered.map(scan => {
          const isExp = expandedId === scan.id;
          const tr = TRIGGER[scan.trigger] || TRIGGER.manual;
          let details: PodDetail[] = [];
          if (scan.details_json) { try { details = JSON.parse(scan.details_json); } catch {} }
          return (
            <div key={scan.id}>
              <div onClick={() => setExpandedId(isExp ? null : scan.id)} style={{
                display: "grid", gridTemplateColumns: "50px 1fr 90px 70px 70px 80px 90px",
                padding: "12px 18px", gap: 10, background: "var(--s1)", alignItems: "center",
                cursor: "pointer", transition: "background 0.1s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>#{scan.id}</span>
                <div><div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{fmtDate(scan.scanned_at)}</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{timeAgo(scan.scanned_at)}</div></div>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>{scan.namespace}</span>
                <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600 }}>{scan.total_pods}</span>
                <span style={{ fontSize: 13, color: "var(--g)", fontWeight: 600 }}>{scan.healthy}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {scan.unhealthy > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--re)" }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: scan.unhealthy > 0 ? "var(--re)" : "var(--g)" }}>{scan.unhealthy}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: tr.color, background: `${tr.color}08`, padding: "3px 10px", borderRadius: 6, textAlign: "center" }}>{tr.label}</span>
              </div>
              {isExp && (
                <div style={{ padding: "16px 18px 16px 68px", background: "var(--s2)" }}>
                  {details.length === 0 ? <p style={{ fontSize: 13, color: "var(--t3)" }}>{scan.unhealthy === 0 ? "Aucun problème détecté" : "Détails non disponibles"}</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600, marginBottom: 4 }}>Pods problématiques</span>
                      {details.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--s1)" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEV_COLOR[d.severity] || "var(--re)" }} />
                          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{d.pod}</div><div style={{ fontSize: 12, color: "var(--t3)", marginTop: 1 }}>{d.restarts} restart{d.restarts !== 1 ? "s" : ""}{d.diagnostic && d.diagnostic !== "None" ? ` · ${d.diagnostic.split(":")[0]}` : ""}</div></div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: SEV_COLOR[d.severity] || "var(--re)", background: `${SEV_COLOR[d.severity] || "var(--re)"}08`, padding: "2px 8px", borderRadius: 6 }}>{d.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {scan.incidents_created > 0 && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--brand)" }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2L6 10l-4-4"/></svg>
                      {scan.incidents_created} incident{scan.incidents_created > 1 ? "s" : ""} créé{scan.incidents_created > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}