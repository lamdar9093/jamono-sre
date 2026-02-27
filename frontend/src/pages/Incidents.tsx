import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Incident {
  id: number;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string;
  environment: string;
  linked_pod: string | null;
  assigned_to: string | null;
  created_by: string;
  slack_channel: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  mttr_seconds: number | null;
}

interface TimelineEntry {
  id: number;
  action: string;
  author: string;
  detail: string;
  timestamp: string;
}

interface MttrStats {
  total: number;
  resolved: number;
  avg_mttr_seconds: number;
  min_mttr_seconds: number;
}

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: "#C04040", label: "Critical" },
  high:     { color: "var(--jam2)", label: "High" },
  medium:   { color: "var(--am)", label: "Medium" },
  low:      { color: "var(--bl)", label: "Low" },
};

const STA: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: "var(--re)", bg: "var(--re-a)", label: "Ouvert" },
  in_progress: { color: "var(--am)", bg: "var(--am-a)", label: "En cours" },
  resolved:    { color: "var(--g)",  bg: "var(--g-a)",  label: "Résolu" },
  watching:    { color: "var(--bl)", bg: "var(--bl-a)", label: "Surveillance" },
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s/60)}min`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}j`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function fmtMttr(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h${Math.floor((s%3600)/60)}m`;
}


export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<MttrStats | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEnv, setFilterEnv] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/incidents`);
      setIncidents(res.data.incidents ?? []);
      setStats(res.data.stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openDetail = async (inc: Incident) => {
    setSelected(inc);
    try {
      const res = await axios.get(`${API_URL}/incidents/${inc.id}`);
      setTimeline(res.data.timeline ?? []);
    } catch (e) { setTimeline([]); }
  };

  const updateStatus = async (id: number, status: string) => {
    await axios.patch(`${API_URL}/incidents/${id}/status`, { status, detail: `Statut → ${status}` });
    await fetch();
    if (selected?.id === id) {
      const res = await axios.get(`${API_URL}/incidents/${id}`);
      setSelected(res.data.incident);
      setTimeline(res.data.timeline ?? []);
    }
  };

  const filtered = incidents.filter(i => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterEnv !== "all" && i.environment !== filterEnv) return false;
    return true;
  });

  const Pill = ({ sev }: { sev: string }) => {
    const s = SEV[sev] || SEV.low;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 6px", borderRadius: 3,
        fontFamily: "var(--fm)", fontSize: 9, fontWeight: 500, letterSpacing: "0.05em",
        color: s.color,
        background: `${s.color}18`,
        border: `1px solid ${s.color}30`,
      }}>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
        {s.label}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STA[status] || STA.open;
    const pulse = status === "open" || status === "in_progress";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 7px", borderRadius: 3,
        fontFamily: "var(--fm)", fontSize: 9, fontWeight: 500, letterSpacing: "0.04em",
        color: s.color, background: s.bg,
      }}>
        <span style={{
          width: 4, height: 4, borderRadius: "50%", background: "currentColor",
          display: "inline-block",
          animation: pulse ? "blink 2s ease-in-out infinite" : "none",
        }} />
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.02em" }}>Incidents</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            // {incidents.length} total · {incidents.filter(i => i.status === "open").length} ouverts
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 5,
          fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--jam2)",
          background: "var(--jam)", color: "#fff",
        }}>
          + Créer
        </button>
      </div>

      {/* Stats MTTR */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[
            { label: "Total", val: stats.total, color: "var(--t1)" },
            { label: "Résolus", val: stats.resolved, color: "var(--g)" },
            { label: "MTTR moyen", val: stats.avg_mttr_seconds ? fmtMttr(stats.avg_mttr_seconds) : "—", color: "var(--jam2)" },
            { label: "Meilleur MTTR", val: stats.min_mttr_seconds ? fmtMttr(stats.min_mttr_seconds) : "—", color: "var(--bl)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "12px 14px" }}>
              <div style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {["all","watching","open","in_progress","resolved"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: "3px 10px", borderRadius: 4,
            fontFamily: "var(--fm)", fontSize: 10, cursor: "pointer",
            border: filterStatus === s ? "1px solid var(--jam-b)" : "1px solid transparent",
            background: filterStatus === s ? "var(--jam-a)" : "transparent",
            color: filterStatus === s ? "var(--jam2)" : "var(--t3)",
            transition: "all 0.1s",
          }}>
            {s === "all" ? "Tous" : STA[s]?.label || s}
          </button>
        ))}
        <div style={{ width: 1, height: 14, background: "var(--b2)", margin: "0 2px" }} />
        {["all","prod","staging","dev"].map(e => (
          <button key={e} onClick={() => setFilterEnv(e)} style={{
            padding: "3px 10px", borderRadius: 4,
            fontFamily: "var(--fm)", fontSize: 10, cursor: "pointer",
            border: filterEnv === e ? "1px solid var(--b3)" : "1px solid transparent",
            background: filterEnv === e ? "var(--s2)" : "transparent",
            color: filterEnv === e ? "var(--t2)" : "var(--t3)",
            transition: "all 0.1s",
          }}>
            {e === "all" ? "Tous envs" : e}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>

        {/* Col headers */}
        <div style={{ display: "grid", gridTemplateColumns: "34px 72px 1fr 88px 90px 64px", padding: "6px 14px", gap: 10, borderBottom: "1px solid var(--b1)" }}>
          {["#","Sévérité","Titre","Statut","Assigné","Âge"].map(h => (
            <span key={h} style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "24px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun incident</p>
          </div>
        ) : filtered.map(inc => (
          <div
            key={inc.id}
            onClick={() => openDetail(inc)}
            style={{
              display: "grid", gridTemplateColumns: "34px 72px 1fr 88px 90px 64px",
              alignItems: "center", padding: "8px 14px", gap: 10,
              borderBottom: "1px solid var(--b1)", cursor: "pointer",
              transition: "background 0.08s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>#{inc.id}</span>
            <Pill sev={inc.severity} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                {inc.title}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                <span style={{
                  padding: "1px 5px", borderRadius: 3, fontFamily: "var(--fm)", fontSize: 8.5,
                  color: inc.environment === "prod" ? "var(--jam2)" : "var(--bl)",
                  background: inc.environment === "prod" ? "var(--jam-a)" : "var(--bl-a)",
                  border: `1px solid ${inc.environment === "prod" ? "var(--jam-b)" : "rgba(58,120,192,0.18)"}`,
                }}>{inc.environment}</span>
                <span style={{
                  padding: "1px 5px", borderRadius: 3, fontFamily: "var(--fm)", fontSize: 8.5,
                  color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b2)",
                }}>
                  {inc.source === "auto" ? "auto" : inc.source === "watch" ? "watch" : "manuel"}
                </span>
              </div>
            </div>
            <StatusBadge status={inc.status} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inc.assigned_to || "—"}
            </span>
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textAlign: "right" }}>
              {timeAgo(inc.created_at)}
            </span>
          </div>
        ))}
      </div>

      {/* Drawer détail */}
      {selected && (
        <>
          <div
            onClick={() => setSelected(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, height: "100%", width: "380px",
            background: "var(--s1)", borderLeft: "1px solid var(--b2)",
            zIndex: 50, display: "flex", flexDirection: "column",
            boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
          }}>
            {/* Drawer header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>#{selected.id}</span>
                <Pill sev={selected.severity} />
                <StatusBadge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Titre */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>{selected.title}</div>
                {selected.description && (
                  <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", marginTop: 6, lineHeight: 1.5 }}>{selected.description}</p>
                )}
              </div>

              {/* Infos */}
              <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
                {[
                  ["Environnement", selected.environment],
                  ["Pod lié", selected.linked_pod || "—"],
                  ["Assigné à", selected.assigned_to || "—"],
                  ["Canal Slack", selected.slack_channel || "—"],
                  ["Créé le", fmtDate(selected.created_at)],
                  ["MTTR", selected.mttr_seconds ? fmtMttr(selected.mttr_seconds) : "En cours..."],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid var(--b1)" }}>
                    <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{k}</span>
                    <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Actions statut */}
              {selected.status !== "resolved" && (
                <div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                    Changer le statut
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.status === "watching" && (
                      <button onClick={() => updateStatus(selected.id, "open")} style={{
                        padding: "5px 12px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                        cursor: "pointer", border: "1px solid rgba(200,75,50,0.3)", background: "var(--jam-a)", color: "var(--jam2)",
                      }}>→ Ouvrir</button>
                    )}
                    {(selected.status === "open" || selected.status === "watching") && (
                      <button onClick={() => updateStatus(selected.id, "in_progress")} style={{
                        padding: "5px 12px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                        cursor: "pointer", border: "1px solid rgba(200,136,10,0.3)", background: "var(--am-a)", color: "var(--am)",
                      }}>→ En cours</button>
                    )}
                    {selected.status !== "watching" && (
                      <button onClick={() => updateStatus(selected.id, "watching")} style={{
                        padding: "5px 12px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                        cursor: "pointer", border: "1px solid rgba(58,120,192,0.3)", background: "var(--bl-a)", color: "var(--bl)",
                      }}>👁 Surveiller</button>
                    )}
                    <button onClick={() => updateStatus(selected.id, "resolved")} style={{
                      padding: "5px 12px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                      cursor: "pointer", border: "1px solid rgba(36,168,118,0.3)", background: "var(--g-a)", color: "var(--g)",
                    }}>✓ Résoudre</button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                  Timeline
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {timeline.map((entry, i) => (
                    <div key={entry.id} style={{ display: "flex", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--jam)", flexShrink: 0, marginTop: 2 }} />
                        {i < timeline.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: "var(--b2)", margin: "3px 0" }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t1)", fontWeight: 500 }}>{entry.action}</span>
                          <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>{entry.author}</span>
                        </div>
                        {entry.detail && (
                          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{entry.detail}</p>
                        )}
                        <p style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>{fmtDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: 10, width: "100%", maxWidth: 460, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Créer un incident</span>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <CreateForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetch(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", severity: "medium", source: "manual",
    environment: "prod", linked_pod: "", assigned_to: "", watch_minutes: 15,
  });
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
    borderRadius: "var(--r)", padding: "6px 10px",
    fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)",
    textTransform: "uppercase" as const, letterSpacing: "0.1em",
    display: "block", marginBottom: 4,
  };

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/incidents`, {
        ...form,
        linked_pod: form.linked_pod || null,
        assigned_to: form.assigned_to || null,
        watch_minutes: form.source === "watch" ? form.watch_minutes : null,
      });
      onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Type */}
      <div>
        <label style={labelStyle}>Type</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ v: "manual", l: "Manuel" }, { v: "watch", l: "Surveillance" }].map(t => (
            <button key={t.v} onClick={() => setForm(p => ({ ...p, source: t.v }))} style={{
              flex: 1, padding: "6px", borderRadius: 5,
              fontFamily: "var(--fm)", fontSize: 11, cursor: "pointer",
              border: form.source === t.v ? "1px solid var(--jam-b)" : "1px solid var(--b2)",
              background: form.source === t.v ? "var(--jam-a)" : "transparent",
              color: form.source === t.v ? "var(--jam2)" : "var(--t3)",
              transition: "all 0.1s",
            }}>{t.l}</button>
          ))}
        </div>
      </div>

      {form.source === "watch" && (
        <div>
          <label style={labelStyle}>Timer surveillance (minutes)</label>
          <input type="number" value={form.watch_minutes}
            onChange={e => setForm(p => ({ ...p, watch_minutes: parseInt(e.target.value) }))}
            style={inputStyle} />
          <p style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 4 }}>
            Si non résolu → incident ouvert automatiquement
          </p>
        </div>
      )}

      <div>
        <label style={labelStyle}>Titre *</label>
        <input type="text" value={form.title} placeholder="Ex: API gateway timeout en prod"
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea value={form.description} rows={3} placeholder="Décris le problème..."
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          style={{ ...inputStyle, resize: "none" as const }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={labelStyle}>Sévérité</label>
          <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} style={inputStyle}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Environnement</label>
          <select value={form.environment} onChange={e => setForm(p => ({ ...p, environment: e.target.value }))} style={inputStyle}>
            <option value="prod">prod</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={labelStyle}>Pod lié</label>
          <input type="text" value={form.linked_pod} placeholder="crash-app2"
            onChange={e => setForm(p => ({ ...p, linked_pod: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Assigné à</label>
          <input type="text" value={form.assigned_to} placeholder="@username"
            onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onClose} style={{
          padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)",
        }}>Annuler</button>
        <button onClick={submit} disabled={saving || !form.title.trim()} style={{
          padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "none", background: "var(--jam)", color: "#fff",
          opacity: saving || !form.title.trim() ? 0.5 : 1,
        }}>
          {saving ? "Création..." : "Créer"}
        </button>
      </div>
    </div>
  );
}