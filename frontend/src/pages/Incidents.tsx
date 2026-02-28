import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";
import Modal, { formInput, FormField, FormActions } from "../components/Modal";

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
  critical: { color: "var(--sev-critical)", label: "Critical" },
  high:     { color: "var(--sev-high)",     label: "High" },
  medium:   { color: "var(--sev-medium)",   label: "Medium" },
  low:      { color: "var(--sev-low)",      label: "Low" },
};

const STA: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: "var(--re)", bg: "var(--re-a)", label: "Ouvert" },
  in_progress: { color: "var(--am)", bg: "var(--am-a)", label: "En cours" },
  resolved:    { color: "var(--g)",  bg: "var(--g-a)",  label: "Résolu" },
  watching:    { color: "var(--bl)", bg: "var(--bl-a)", label: "Surveillance" },
};

const TL_COLOR: Record<string, string> = {
  created: "var(--brand)", status: "var(--am)", resolved: "var(--g)",
  assigned: "var(--bl)", comment: "var(--purple)",
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtMttr(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", color: s.color, background: `${s.color}14` }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
        {s.label}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STA[status] || STA.open;
    const pulse = status === "open" || status === "in_progress";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 5, fontFamily: "var(--fm)", fontSize: 10, fontWeight: 500, letterSpacing: "0.03em", color: s.color, background: s.bg }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", boxShadow: pulse ? `0 0 6px ${s.color}60` : "none", animation: pulse ? "pulse 2s ease-in-out infinite" : "none" }} />
        {s.label}
      </span>
    );
  };

  const SlackBadge = ({ channel }: { channel: string | null }) => {
    if (!channel) return <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>—</span>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontFamily: "var(--fm)", fontSize: 9.5, fontWeight: 500, color: "var(--slack)", background: "var(--slack-a)" }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="var(--slack)"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/><path d="M1.5 9.5A1.5 1.5 0 003 11h4V9.5A1.5 1.5 0 001.5 9.5z" opacity="0.8"/><path d="M6.5 14.5A1.5 1.5 0 008 13V9H6.5A1.5 1.5 0 006.5 14.5z" opacity="0.8"/><path d="M14.5 6.5A1.5 1.5 0 0013 5H9v1.5A1.5 1.5 0 0014.5 6.5z" opacity="0.8"/></svg>
        Slack
      </span>
    );
  };

  const activeIncidents = incidents.filter(i => i.status !== "resolved");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Incidents</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{incidents.length} total · {activeIncidents.length} ouverts</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: "var(--r)", fontFamily: "var(--f)", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "var(--re)", color: "#fff", boxShadow: "0 2px 10px rgba(248,113,113,0.25)" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
          Déclarer un incident
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "Total", val: stats.total, color: "var(--brand)" },
            { label: "Résolus", val: stats.resolved, color: "var(--g)" },
            { label: "MTTR moyen", val: stats.avg_mttr_seconds ? fmtMttr(stats.avg_mttr_seconds) : "—", color: "var(--am)" },
            { label: "Meilleur MTTR", val: stats.min_mttr_seconds ? fmtMttr(stats.min_mttr_seconds) : "—", color: "var(--bl)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "16px 18px", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${s.color}35`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.color}, transparent)`, opacity: 0.5 }} />
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: s.color, fontFamily: "var(--fm)" }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {["all", "watching", "open", "in_progress", "resolved"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "5px 12px", borderRadius: "var(--r)", fontFamily: "var(--fm)", fontSize: 11, cursor: "pointer", border: filterStatus === s ? "1px solid var(--brand-b)" : "1px solid transparent", background: filterStatus === s ? "var(--brand-a)" : "transparent", color: filterStatus === s ? "var(--brand2)" : "var(--t3)", fontWeight: filterStatus === s ? 600 : 400, transition: "all 0.12s" }}>
            {s === "all" ? "Tous" : STA[s]?.label || s}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: "var(--b2)", margin: "0 4px" }} />
        {["all", "prod", "staging", "dev"].map(e => (
          <button key={e} onClick={() => setFilterEnv(e)} style={{ padding: "5px 12px", borderRadius: "var(--r)", fontFamily: "var(--fm)", fontSize: 11, cursor: "pointer", border: filterEnv === e ? "1px solid var(--b3)" : "1px solid transparent", background: filterEnv === e ? "var(--s2)" : "transparent", color: filterEnv === e ? "var(--t1)" : "var(--t3)", fontWeight: filterEnv === e ? 500 : 400, transition: "all 0.12s" }}>
            {e === "all" ? "Tous envs" : e}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 80px 1fr 75px 95px 80px 55px", padding: "8px 16px", gap: 10, borderBottom: "1px solid var(--b1)" }}>
          {["#", "Sévérité", "Titre", "Slack", "Statut", "Assigné", "Âge"].map(h => (
            <span key={h} style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}><p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center" }}><p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun incident</p></div>
        ) : filtered.map(inc => (
          <div key={inc.id} onClick={() => openDetail(inc)} style={{ display: "grid", gridTemplateColumns: "40px 80px 1fr 75px 95px 80px 55px", alignItems: "center", padding: "10px 16px", gap: 10, borderBottom: "1px solid var(--b1)", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
            <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>#{inc.id}</span>
            <Pill sev={inc.severity} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inc.title}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                <span style={{ padding: "1px 6px", borderRadius: 4, fontFamily: "var(--fm)", fontSize: 9, color: inc.environment === "prod" ? "var(--sev-high)" : "var(--bl)", background: inc.environment === "prod" ? "var(--sev-high-a)" : "var(--bl-a)", fontWeight: 500 }}>{inc.environment}</span>
                <span style={{ padding: "1px 6px", borderRadius: 4, fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b2)" }}>{inc.source === "auto" ? "auto" : inc.source === "watch" ? "watch" : "manuel"}</span>
              </div>
            </div>
            <SlackBadge channel={inc.slack_channel} />
            <StatusBadge status={inc.status} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.assigned_to || "—"}</span>
            <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textAlign: "right" }}>{timeAgo(inc.created_at)}</span>
          </div>
        ))}
      </div>

      {/* Detail Drawer */}
      {selected && <DetailDrawer selected={selected} timeline={timeline} onClose={() => setSelected(null)} updateStatus={updateStatus} Pill={Pill} StatusBadge={StatusBadge} />}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Déclarer un incident" width={500}>
        <CreateForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetch(); }} />
      </Modal>
    </div>
  );
}

function DetailDrawer({ selected, timeline, onClose, updateStatus, Pill, StatusBadge }: { selected: Incident; timeline: TimelineEntry[]; onClose: () => void; updateStatus: (id: number, status: string) => void; Pill: any; StatusBadge: any }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, animation: "fadeIn 0.15s ease" }} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 400, background: "var(--s1)", borderLeft: "1px solid var(--b1)", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(0,0,0,0.4)", animation: "slideIn 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--b1)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>#{selected.id}</span>
            <Pill sev={selected.severity} /><StatusBadge status={selected.status} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{selected.title}</div>
            {selected.description && <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", marginTop: 8, lineHeight: 1.6 }}>{selected.description}</p>}
          </div>
          <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {([["Environnement", selected.environment], ["Pod lié", selected.linked_pod || "—"], ["Assigné à", selected.assigned_to || "—"], ["Canal Slack", selected.slack_channel || "—"], ["Créé le", fmtDate(selected.created_at)], ["MTTR", selected.mttr_seconds ? fmtMttr(selected.mttr_seconds) : "En cours..."]] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid var(--b1)" }}>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>{k}</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", fontWeight: 500, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}
          </div>
          {selected.slack_channel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "var(--slack-a)", border: "1px solid rgba(224,30,90,0.15)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--slack)"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/><path d="M1.5 9.5A1.5 1.5 0 003 11h4V9.5A1.5 1.5 0 001.5 9.5z" opacity="0.8"/><path d="M6.5 14.5A1.5 1.5 0 008 13V9H6.5A1.5 1.5 0 006.5 14.5z" opacity="0.8"/><path d="M14.5 6.5A1.5 1.5 0 0013 5H9v1.5A1.5 1.5 0 0014.5 6.5z" opacity="0.8"/></svg>
              <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--slack)", fontWeight: 600 }}>{selected.slack_channel}</span>
            </div>
          )}
          {selected.status !== "resolved" && (
            <div>
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>Changer le statut</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selected.status === "watching" && <ActionBtn label="→ Ouvrir" color="var(--sev-high)" onClick={() => updateStatus(selected.id, "open")} />}
                {(selected.status === "open" || selected.status === "watching") && <ActionBtn label="→ En cours" color="var(--am)" onClick={() => updateStatus(selected.id, "in_progress")} />}
                {selected.status !== "watching" && <ActionBtn label="👁 Surveiller" color="var(--bl)" onClick={() => updateStatus(selected.id, "watching")} />}
                <ActionBtn label="✓ Résoudre" color="var(--g)" onClick={() => updateStatus(selected.id, "resolved")} />
              </div>
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>Timeline</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {timeline.map((entry, i) => {
                const dotColor = TL_COLOR[entry.action] || "var(--brand)";
                return (
                  <div key={entry.id} style={{ display: "flex", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 3, boxShadow: `0 0 6px ${dotColor}40` }} />
                      {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b2)", margin: "3px 0" }} />}
                    </div>
                    <div style={{ paddingBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 10.5, color: dotColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{entry.action}</span>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{entry.author}</span>
                      </div>
                      {entry.detail && <p style={{ fontFamily: "var(--fm)", fontSize: 10.5, color: "var(--t2)", marginTop: 3, lineHeight: 1.5 }}>{entry.detail}</p>}
                      <p style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 3 }}>{fmtDate(entry.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: "var(--r)", fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1px solid ${color}25`, background: `${color}12`, color, transition: "all 0.12s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}12`; }}
    >{label}</button>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", source: "manual", environment: "prod", linked_pod: "", assigned_to: "", watch_minutes: 15 });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors: Record<string, string> = {};
  if (touched.title && !form.title.trim()) errors.title = "Le titre est requis";

  const submit = async () => {
    setTouched({ title: true });
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/incidents`, { ...form, linked_pod: form.linked_pod || null, assigned_to: form.assigned_to || null, watch_minutes: form.source === "watch" ? form.watch_minutes : null });
      onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <FormField label="Type">
        <div style={{ display: "flex", gap: 6 }}>
          {[{ v: "manual", l: "Manuel" }, { v: "watch", l: "Surveillance" }].map(t => (
            <button key={t.v} onClick={() => setForm(p => ({ ...p, source: t.v }))} style={{ flex: 1, padding: "8px", borderRadius: "var(--r)", fontFamily: "var(--fm)", fontSize: 12, cursor: "pointer", border: form.source === t.v ? "1px solid var(--brand-b)" : "1px solid var(--b2)", background: form.source === t.v ? "var(--brand-a)" : "transparent", color: form.source === t.v ? "var(--brand2)" : "var(--t3)", fontWeight: form.source === t.v ? 600 : 400, transition: "all 0.12s" }}>{t.l}</button>
          ))}
        </div>
      </FormField>
      {form.source === "watch" && (
        <FormField label="Timer surveillance (minutes)">
          <input type="number" value={form.watch_minutes} onChange={e => setForm(p => ({ ...p, watch_minutes: parseInt(e.target.value) }))} style={formInput} />
          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>Si non résolu → incident ouvert automatiquement</p>
        </FormField>
      )}
      <FormField label="Titre" required error={errors.title}>
        <input type="text" value={form.title} placeholder="Ex: API gateway timeout en prod" onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, title: true }))} style={{ ...formInput, borderColor: errors.title ? "var(--re)" : undefined }} />
      </FormField>
      <FormField label="Description">
        <textarea value={form.description} rows={3} placeholder="Décris le problème..." onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...formInput, resize: "none", fontFamily: "var(--fm)" }} />
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Sévérité">
          <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} style={formInput}>
            <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </FormField>
        <FormField label="Environnement">
          <select value={form.environment} onChange={e => setForm(p => ({ ...p, environment: e.target.value }))} style={formInput}>
            <option value="prod">prod</option><option value="staging">staging</option><option value="dev">dev</option>
          </select>
        </FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Pod lié"><input type="text" value={form.linked_pod} placeholder="crash-app2" onChange={e => setForm(p => ({ ...p, linked_pod: e.target.value }))} style={formInput} /></FormField>
        <FormField label="Assigné à"><input type="text" value={form.assigned_to} placeholder="@username" onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={formInput} /></FormField>
      </div>
      <FormActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "Création..." : "Déclarer"} submitting={saving} disabled={!form.title.trim()} />
    </div>
  );
}