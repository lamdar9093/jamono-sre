import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface AuditEntry {
  id: number;
  timestamp: string;
  incident_id?: number;
  action: string;
  author: string;
  detail: string;
  pod_name?: string;
  action_type?: string;
  change_before?: string;
  change_after?: string;
  approved_by?: string;
  status?: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s/60)}min`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}j`;
}

const ACTION_COLOR: Record<string, string> = {
  created:  "var(--brand)",
  status:   "var(--bl)",
  resolved: "var(--g)",
  assigned: "var(--am)",
  analysed: "var(--bl)",
  success:  "var(--g)",
  failed:   "var(--re)",
  pending:  "var(--am)",
};

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  success:     { color: "var(--g)",  bg: "var(--g-a)",  label: "Succès" },
  failed:      { color: "var(--re)", bg: "var(--re-a)", label: "Échec" },
  rolled_back: { color: "var(--t2)", bg: "var(--s2)",   label: "Rollback" },
  pending:     { color: "var(--am)", bg: "var(--am-a)", label: "En attente" },
};

export default function History() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"incidents" | "remediation">("incidents");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/audit`);
      const data = res.data.entries ?? res.data.logs ?? [];
      setEntries(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return (
      (e.action || "").toLowerCase().includes(q) ||
      (e.author || "").toLowerCase().includes(q) ||
      (e.detail || "").toLowerCase().includes(q) ||
      (e.pod_name || "").toLowerCase().includes(q) ||
      String(e.incident_id || "").includes(q)
    );
  });

  const hasRemediationData = entries.some(e => e.pod_name || e.action_type);

  const stats = [
    { label: "Total", val: entries.length, color: "var(--t1)" },
    { label: "Succès", val: entries.filter(e => e.status === "success").length, color: "var(--g)" },
    { label: "Échecs", val: entries.filter(e => e.status === "failed").length, color: "var(--re)" },
    { label: "Incidents", val: entries.filter(e => e.incident_id).length, color: "var(--brand)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Historique</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>
            {entries.length} événements enregistrés
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{
              background: "var(--s2)", border: "1px solid var(--b2)",
              borderRadius: "var(--r)", padding: "6px 12px",
              fontFamily: "var(--fm)", fontSize: 11,
              color: "var(--t1)", outline: "none", width: 200,
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-b)"}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"}
          />
          <button onClick={fetchLogs} style={{
            padding: "6px 14px", borderRadius: "var(--r)",
            fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
            cursor: "pointer", border: "1px solid var(--b2)",
            background: "transparent", color: "var(--t2)",
            transition: "all 0.12s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
          >↻</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {stats.map(s => (
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

      {/* View toggle */}
      {hasRemediationData && (
        <div style={{ display: "flex", gap: 2, background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: 4, width: "fit-content" }}>
          {[
            { key: "incidents", label: "Audit incidents" },
            { key: "remediation", label: "Remédiations" },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)} style={{
              padding: "5px 14px", borderRadius: 6,
              fontFamily: "var(--fm)", fontSize: 11, cursor: "pointer",
              border: "none",
              background: view === t.key ? "var(--s2)" : "transparent",
              color: view === t.key ? "var(--t1)" : "var(--t3)",
              fontWeight: view === t.key ? 600 : 400,
              transition: "all 0.12s",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Timeline — incidents view */}
      {view === "incidents" && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--b1)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--bl)" }} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Audit log
            </span>
            <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b2)", padding: "2px 6px", borderRadius: 4 }}>
              {filtered.length}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun événement</p>
            </div>
          ) : (
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" }}>
              {filtered.map((entry, i) => (
                <div key={entry.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                      background: ACTION_COLOR[entry.action] || "var(--t3)",
                      boxShadow: `0 0 6px ${ACTION_COLOR[entry.action] || "var(--t3)"}40`,
                    }} />
                    {i < filtered.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: "var(--b2)", margin: "4px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "var(--fm)", fontSize: 10.5, fontWeight: 600,
                        color: ACTION_COLOR[entry.action] || "var(--t2)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>
                        {entry.action || entry.action_type}
                      </span>
                      {entry.incident_id && (
                        <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b2)", padding: "2px 6px", borderRadius: 4 }}>
                          #{entry.incident_id}
                        </span>
                      )}
                      {entry.pod_name && (
                        <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)" }}>
                          {entry.pod_name}
                        </span>
                      )}
                      <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>
                        {entry.author || entry.approved_by}
                      </span>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginLeft: "auto" }}>
                        {timeAgo(entry.timestamp)}
                      </span>
                    </div>
                    {(entry.detail || (entry.change_before && entry.change_after)) && (
                      <p style={{ fontFamily: "var(--fm)", fontSize: 10.5, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>
                        {entry.detail || `${entry.change_before} → ${entry.change_after}`}
                      </p>
                    )}
                    {entry.status && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        marginTop: 5, padding: "2px 7px", borderRadius: 4,
                        fontFamily: "var(--fm)", fontSize: 9.5,
                        color: STATUS_COLOR[entry.status]?.color || "var(--t3)",
                        background: STATUS_COLOR[entry.status]?.bg || "var(--s2)",
                      }}>
                        {STATUS_COLOR[entry.status]?.label || entry.status}
                      </span>
                    )}
                    <p style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 3 }}>
                      {fmtDate(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table — remediation view */}
      {view === "remediation" && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--b1)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)" }} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Actions de remédiation
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "36px 140px 1fr 120px 160px 80px 90px", padding: "8px 16px", gap: 10, borderBottom: "1px solid var(--b1)" }}>
            {["#","Date","Pod","Action","Changement","Par","Statut"].map(h => (
              <span key={h} style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</span>
            ))}
          </div>

          {filtered.map(entry => {
            const st = STATUS_COLOR[entry.status || ""];
            return (
              <div key={entry.id} style={{
                display: "grid", gridTemplateColumns: "36px 140px 1fr 120px 160px 80px 90px",
                padding: "9px 16px", gap: 10, borderBottom: "1px solid var(--b1)",
                alignItems: "center", transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>#{entry.id}</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)" }}>{fmtDate(entry.timestamp)}</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.pod_name || "—"}
                </span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--brand)" }}>{entry.action_type || entry.action}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--fm)", fontSize: 10, overflow: "hidden" }}>
                  <span style={{ color: "var(--re)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.change_before || "—"}</span>
                  <span style={{ color: "var(--t3)", flexShrink: 0 }}>→</span>
                  <span style={{ color: "var(--g)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.change_after || "—"}</span>
                </div>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{entry.approved_by || entry.author || "—"}</span>
                {st ? (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 4, fontFamily: "var(--fm)", fontSize: 9.5, color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                ) : (
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}