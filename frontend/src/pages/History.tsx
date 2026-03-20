import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface AuditEntry { id: number; timestamp: string; incident_id?: number; action: string; author: string; detail: string; pod_name?: string; action_type?: string; change_before?: string; change_after?: string; approved_by?: string; status?: string; }

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function timeAgo(d: string) { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return `${Math.floor(s)}s`; if (s < 3600) return `${Math.floor(s / 60)}min`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}j`; }

const AC: Record<string, string> = { created: "var(--brand)", status: "var(--bl)", resolved: "var(--g)", assigned: "var(--am)", analysed: "var(--bl)", success: "var(--g)", failed: "var(--re)", pending: "var(--am)" };
const SC: Record<string, { color: string; label: string }> = { success: { color: "var(--g)", label: "Succès" }, failed: { color: "var(--re)", label: "Échec" }, rolled_back: { color: "var(--t2)", label: "Rollback" }, pending: { color: "var(--am)", label: "En attente" } };

export default function History() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"incidents" | "remediation">("incidents");

  const fetchLogs = async () => { setLoading(true); try { const res = await axios.get(`${API_URL}/audit`); setEntries(res.data.entries ?? res.data.logs ?? []); } catch (e) { console.error(e); } finally { setLoading(false); } };
  useEffect(() => { fetchLogs(); }, []);

  const filtered = entries.filter(e => { const q = search.toLowerCase(); return (e.action || "").toLowerCase().includes(q) || (e.author || "").toLowerCase().includes(q) || (e.detail || "").toLowerCase().includes(q) || (e.pod_name || "").toLowerCase().includes(q) || String(e.incident_id || "").includes(q); });
  const hasRemediation = entries.some(e => e.pod_name || e.action_type);

  const stats = [
    { label: "Total", val: entries.length, color: "var(--t1)" },
    { label: "Succès", val: entries.filter(e => e.status === "success").length, color: "var(--g)" },
    { label: "Échecs", val: entries.filter(e => e.status === "failed").length, color: "var(--re)" },
    { label: "Incidents", val: entries.filter(e => e.incident_id).length, color: "var(--brand)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Historique</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{entries.length} événements enregistrés</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "var(--t1)", outline: "none", width: 220, transition: "border-color 0.15s" }} onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
          <button onClick={fetchLogs} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", transition: "all 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>↻</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "var(--s1)", padding: "20px 24px" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      {hasRemediation && (
        <div style={{ display: "flex", gap: 4 }}>
          {[{ k: "incidents", l: "Audit incidents" }, { k: "remediation", l: "Remédiations" }].map(t => (
            <button key={t.k} onClick={() => setView(t.k as any)} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "none",
              fontWeight: view === t.k ? 600 : 400, background: view === t.k ? "var(--t1)" : "transparent",
              color: view === t.k ? "#fff" : "var(--t3)", transition: "all 0.12s",
            }}>{t.l}</button>
          ))}
        </div>
      )}

      {/* Timeline view */}
      {view === "incidents" && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Audit log</h3>
            <span style={{ fontSize: 12, color: "var(--t3)", background: "var(--s2)", padding: "2px 8px", borderRadius: 6 }}>{filtered.length}</span>
          </div>
          {loading ? <p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement...</p> : filtered.length === 0 ? <p style={{ fontSize: 13, color: "var(--t3)" }}>Aucun événement</p> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filtered.map((entry, i) => {
                const dc = AC[entry.action] || "var(--t3)";
                return (
                  <div key={entry.id} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dc, flexShrink: 0, marginTop: 4 }} />
                      {i < filtered.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b1)", margin: "4px 0" }} />}
                    </div>
                    <div style={{ paddingBottom: 18, flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: dc }}>{entry.action || entry.action_type}</span>
                        {entry.incident_id && <span style={{ fontSize: 11, color: "var(--t3)", background: "var(--s2)", padding: "2px 6px", borderRadius: 4 }}>#{entry.incident_id}</span>}
                        {entry.pod_name && <span style={{ fontSize: 12, color: "var(--t2)" }}>{entry.pod_name}</span>}
                        <span style={{ fontSize: 11, color: "var(--t3)" }}>{entry.author || entry.approved_by}</span>
                        <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>{timeAgo(entry.timestamp)}</span>
                      </div>
                      {(entry.detail || (entry.change_before && entry.change_after)) && <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>{entry.detail || `${entry.change_before} → ${entry.change_after}`}</p>}
                      {entry.status && <span style={{ display: "inline-flex", marginTop: 5, padding: "2px 8px", borderRadius: 4, fontSize: 11, color: SC[entry.status]?.color || "var(--t3)", background: `${SC[entry.status]?.color || "var(--t3)"}08` }}>{SC[entry.status]?.label || entry.status}</span>}
                      <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{fmtDate(entry.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Remediation table */}
      {view === "remediation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "36px 140px 1fr 120px 160px 80px 90px", padding: "10px 18px", gap: 10, background: "var(--s2)" }}>
            {["#", "Date", "Pod", "Action", "Changement", "Par", "Statut"].map(h => <span key={h} style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{h}</span>)}
          </div>
          {filtered.map(entry => {
            const st = SC[entry.status || ""];
            return (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "36px 140px 1fr 120px 160px 80px 90px", padding: "10px 18px", gap: 10, background: "var(--s1)", alignItems: "center", transition: "background 0.1s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>#{entry.id}</span>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>{fmtDate(entry.timestamp)}</span>
                <span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.pod_name || "—"}</span>
                <span style={{ fontSize: 12, color: "var(--brand)" }}>{entry.action_type || entry.action}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, overflow: "hidden" }}>
                  <span style={{ color: "var(--re)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.change_before || "—"}</span>
                  <span style={{ color: "var(--t3)", flexShrink: 0 }}>→</span>
                  <span style={{ color: "var(--g)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.change_after || "—"}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>{entry.approved_by || entry.author || "—"}</span>
                {st ? <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: st.color, background: `${st.color}08` }}>{st.label}</span> : <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}