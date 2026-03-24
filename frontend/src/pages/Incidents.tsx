import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import API_URL from "../config";
import Modal, { formInput, FormField, FormActions } from "../components/Modal";
import KanbanBoard from "../components/KanbanBoard";

interface Incident {
  id: number; title: string; description: string | null; severity: string; status: string;
  source: string; environment: string; linked_pod: string | null; assigned_to: string | null;
  created_by: string; slack_channel: string | null; created_at: string; updated_at: string;
  resolved_at: string | null; mttr_seconds: number | null;
}
interface TimelineEntry { id: number; action: string; author: string; detail: string; timestamp: string; }
interface MttrStats { total: number; resolved: number; avg_mttr_seconds: number; min_mttr_seconds: number; }

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: "var(--sev-critical)", label: "Critical" },
  high: { color: "var(--sev-high)", label: "High" },
  medium: { color: "var(--sev-medium)", label: "Medium" },
  low: { color: "var(--sev-low)", label: "Low" },
};
const STA: Record<string, { color: string; label: string }> = {
  open: { color: "var(--re)", label: "Open" },
  in_progress: { color: "var(--am)", label: "In progress" },
  resolved: { color: "var(--g)", label: "Resolved" },
  watching: { color: "var(--bl)", label: "Watching" },
};
const TL_COLOR: Record<string, string> = {
  created: "var(--brand)", status: "var(--am)", resolved: "var(--g)", assigned: "var(--bl)", comment: "var(--purple)",
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtMttr(s: number) {
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

export default function Incidents() {
  const location = useLocation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<MttrStats | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEnv, setFilterEnv] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    if ((location.state as any)?.openCreate) { setShowCreate(true); window.history.replaceState({}, ""); }
  }, [location.state]);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/incidents`); setIncidents(res.data.incidents ?? []); setStats(res.data.stats); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get("open");
    if (openId && incidents.length > 0) {
      const inc = incidents.find(i => i.id === Number(openId));
      if (inc) { openDetail(inc); window.history.replaceState({}, "", "/incidents"); }
    }
  }, [location.search, incidents]);

  const openDetail = async (inc: Incident) => {
    setSelected(inc);
    try { const res = await axios.get(`${API_URL}/incidents/${inc.id}`); setTimeline(res.data.timeline ?? []); }
    catch (e) { setTimeline([]); }
  };

  const updateStatus = async (id: number, status: string) => {
    await axios.patch(`${API_URL}/incidents/${id}/status`, { status, detail: `Statut → ${status}` });
    await fetchData();
    if (selected?.id === id) {
      const res = await axios.get(`${API_URL}/incidents/${id}`);
      setSelected(res.data.incident); setTimeline(res.data.timeline ?? []);
    }
  };

  const filtered = incidents.filter(i => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterEnv !== "all" && i.environment !== filterEnv) return false;
    return true;
  });

  const activeIncidents = incidents.filter(i => i.status !== "resolved");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Incidents</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{incidents.length} total · {activeIncidents.length} active</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Total", val: stats.total, color: "var(--t1)" },
            { label: "Resolved", val: stats.resolved, color: "var(--g)" },
            { label: "Avg MTTR", val: stats.avg_mttr_seconds ? fmtMttr(stats.avg_mttr_seconds) : "—", color: "var(--am)" },
            { label: "Best MTTR", val: stats.min_mttr_seconds ? fmtMttr(stats.min_mttr_seconds) : "—", color: "var(--bl)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--s1)", padding: "20px 24px" }}>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {["all", "watching", "open", "in_progress", "resolved"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            border: "none", fontWeight: filterStatus === s ? 600 : 400,
            background: filterStatus === s ? "var(--t1)" : "transparent",
            color: filterStatus === s ? "#fff" : "var(--t3)",
            transition: "all 0.12s",
          }}>{s === "all" ? "All" : STA[s]?.label || s}</button>
        ))}
        <div style={{ width: 1, height: 20, background: "var(--b2)", margin: "0 8px" }} />
        {["all", "prod", "staging", "dev"].map(e => (
          <button key={e} onClick={() => setFilterEnv(e)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            border: "none", fontWeight: filterEnv === e ? 500 : 400,
            background: filterEnv === e ? "var(--s3)" : "transparent",
            color: filterEnv === e ? "var(--t1)" : "var(--t3)",
            transition: "all 0.12s",
          }}>{e === "all" ? "All envs" : e}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 2, background: "var(--s2)", borderRadius: 8, padding: 3 }}>
          {([["list", <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>], ["board", <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="1" width="4" height="14" rx="1"/><rect x="6" y="1" width="4" height="14" rx="1"/><rect x="11" y="1" width="4" height="14" rx="1"/></svg>]] as [string, React.ReactNode][]).map(([v, icon]) => (
            <button key={v} onClick={() => setView(v as "list" | "board")} style={{
              width: 30, height: 26, borderRadius: 6, border: "none", cursor: "pointer", display: "grid", placeItems: "center",
              background: view === v ? "var(--s1)" : "transparent",
              color: view === v ? "var(--t1)" : "var(--t3)",
              transition: "all 0.12s",
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* Board / Table */}
      {view === "board" ? (
        <KanbanBoard incidents={filtered} onStatusChange={updateStatus} onSelect={openDetail} />
      ) : null}
      <div style={{ display: view === "list" ? "flex" : "none", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "44px 80px 1fr 75px 100px 80px 44px",
          padding: "10px 18px", gap: 10, background: "var(--s2)", alignItems: "center",
        }}>
          {["#", "Severity", "Title", "Slack", "Status", "Assignee", "Age"].map(h => (
            <span key={h} style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px 18px", textAlign: "center", background: "var(--s1)" }}>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center", background: "var(--s1)" }}>
            <p style={{ fontSize: 14, color: "var(--t3)" }}>No incidents found</p>
          </div>
        ) : filtered.map(inc => {
          const sev = SEV[inc.severity] || SEV.low;
          const sta = STA[inc.status] || STA.open;
          return (
            <div key={inc.id} onClick={() => openDetail(inc)} style={{
              display: "grid", gridTemplateColumns: "44px 80px 1fr 75px 100px 80px 44px",
              alignItems: "center", padding: "12px 18px", gap: 10,
              background: "var(--s1)", cursor: "pointer", transition: "background 0.1s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}
            >
              <span style={{ fontSize: 12, color: "var(--t3)" }}>#{inc.id}</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 6,
                fontSize: 11, fontWeight: 500, color: sev.color, background: `${sev.color}10`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                {sev.label}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inc.title}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                  <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, color: inc.environment === "prod" ? "var(--sev-high)" : "var(--bl)", background: inc.environment === "prod" ? "var(--sev-high-a)" : "var(--bl-a)", fontWeight: 500 }}>{inc.environment}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, color: "var(--t3)", background: "var(--s2)" }}>{inc.source === "auto" ? "auto" : inc.source === "watch" ? "watch" : "manual"}</span>
                </div>
              </div>
              {inc.slack_channel ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, color: "#E01E5A", background: "rgba(224,30,90,0.06)", padding: "2px 8px", borderRadius: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="#E01E5A"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/></svg>
                  Slack
                </span>
              ) : <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6,
                fontSize: 11, fontWeight: 500, color: sta.color, background: `${sta.color}08`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                {sta.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.assigned_to || "—"}</span>
              <span style={{ fontSize: 12, color: "var(--t3)", textAlign: "right" }}>{timeAgo(inc.created_at)}</span>
            </div>
          );
        })}
      </div>

      {/* Detail Drawer */}
      {selected && <DetailDrawer selected={selected} timeline={timeline} onClose={() => setSelected(null)} updateStatus={updateStatus} />}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Declare an incident" width={500}>
        <CreateForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />
      </Modal>
    </div>
  );
}

/* ═══ Detail Drawer ═══ */
function DetailDrawer({ selected, timeline, onClose, updateStatus }: {
  selected: Incident; timeline: TimelineEntry[]; onClose: () => void; updateStatus: (id: number, s: string) => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  const sev = SEV[selected.severity] || SEV.low;
  const sta = STA[selected.status] || STA.open;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40, animation: "fadeIn 0.15s ease" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100%", width: 420,
        background: "var(--s1)", borderLeft: "1px solid var(--b1)", zIndex: 50,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.08)", animation: "slideIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--b1)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={`/incidents/${selected.id}`} style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
            >#{selected.id}</a>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sev.color, background: `${sev.color}10` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} /> {sev.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sta.color, background: `${sta.color}08` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} /> {sta.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{selected.title}</h2>
            {selected.description && <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 8, lineHeight: 1.7 }}>{selected.description}</p>}
          </div>

          {/* Properties */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 10, overflow: "hidden" }}>
            {([
              ["Environment", selected.environment], ["Pod", selected.linked_pod || "—"],
              ["Assignee", selected.assigned_to || "—"], ["Slack", selected.slack_channel || "—"],
              ["Created", fmtDate(selected.created_at)],
              ["MTTR", selected.mttr_seconds ? fmtMttr(selected.mttr_seconds) : "In progress..."],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "var(--s1)" }}>
                <span style={{ fontSize: 13, color: "var(--t3)" }}>{k}</span>
                <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Links */}
          <IncidentLinks incidentId={selected.id} />

          {/* Status actions */}
          {selected.status !== "resolved" && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Change status</h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selected.status === "watching" && <ActionBtn label="Open" color="var(--sev-high)" onClick={() => updateStatus(selected.id, "open")} />}
                {(selected.status === "open" || selected.status === "watching") && <ActionBtn label="In progress" color="var(--am)" onClick={() => updateStatus(selected.id, "in_progress")} />}
                {selected.status !== "watching" && <ActionBtn label="Watch" color="var(--bl)" onClick={() => updateStatus(selected.id, "watching")} />}
                <ActionBtn label="Resolve" color="var(--g)" onClick={() => updateStatus(selected.id, "resolved")} />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Activity</h3>
            {timeline.map((entry, i) => {
              const dotColor = TL_COLOR[entry.action] || "var(--brand)";
              return (
                <div key={entry.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 3 }} />
                    {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b2)", margin: "4px 0" }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: dotColor, fontWeight: 600 }}>{entry.action}</span>
                      <span style={{ fontSize: 12, color: "var(--t3)" }}>{entry.author}</span>
                    </div>
                    {entry.detail && <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 3, lineHeight: 1.5 }}>{entry.detail}</p>}
                    <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{fmtDate(entry.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══ Incident Links ═══ */
function IncidentLinks({ incidentId }: { incidentId: number }) {
  const [links, setLinks] = useState<{ id: number; integration_type: string; external_id: string; external_url: string }[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const fetchLinks = async () => { try { const res = await axios.get(`${API_URL}/incidents/${incidentId}/links`); setLinks(res.data.links ?? []); } catch (e) {} };
  useEffect(() => { fetchLinks(); }, [incidentId]);
  const createTicket = async (type: string) => { setCreating(type); try { await axios.post(`${API_URL}/incidents/${incidentId}/ticket`, { integration_type: type }); fetchLinks(); } catch (e) { console.error(e); } finally { setCreating(null); } };

  const STYLE: Record<string, { fg: string; label: string }> = {
    jira: { fg: "#0052CC", label: "Jira" }, servicenow: { fg: "#008537", label: "ServiceNow" }, github: { fg: "var(--t1)", label: "GitHub" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {links.map(link => {
        const s = STYLE[link.integration_type] || STYLE.github;
        return (
          <a key={link.id} href={link.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8,
            background: `${s.fg}06`, border: `1px solid ${s.fg}12`, textDecoration: "none", transition: "all 0.12s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${s.fg}30`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${s.fg}12`; }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: s.fg }}>{s.label}</span>
            <span style={{ fontSize: 13, color: s.fg, fontWeight: 600 }}>{link.external_id}</span>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={s.fg} strokeWidth="1.5" strokeLinecap="round" style={{ marginLeft: "auto", opacity: 0.4 }}><path d="M6 3h7v7M13 3L6 10"/></svg>
          </a>
        );
      })}
      {!links.some(l => l.integration_type === "jira") && (
        <button onClick={() => createTicket("jira")} disabled={creating === "jira"} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          cursor: creating === "jira" ? "not-allowed" : "pointer",
          border: "1px dashed rgba(0,82,204,0.2)", background: "transparent",
          color: "#0052CC", opacity: creating === "jira" ? 0.5 : 1, transition: "all 0.12s",
        }}
          onMouseEnter={e => { if (creating !== "jira") { (e.currentTarget as HTMLElement).style.background = "rgba(0,82,204,0.04)"; (e.currentTarget as HTMLElement).style.borderStyle = "solid"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderStyle = "dashed"; }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
          {creating === "jira" ? "Creating..." : "Create Jira ticket"}
        </button>
      )}
    </div>
  );
}

/* ═══ Action Button ═══ */
function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
      cursor: "pointer", border: `1px solid ${color}20`, background: `${color}06`, color, transition: "all 0.12s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}14`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}06`; }}
    >{label}</button>
  );
}

/* ═══ Create Form ═══ */
function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", summary: "", severity: "medium", environment: "prod", assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeIntegrations, setActiveIntegrations] = useState<{ type: string; display_name: string; category: string }[]>([]);
  const [actions, setActions] = useState<Record<string, boolean>>({});
  const hasError = submitted && !form.title.trim();

  useEffect(() => { axios.get(`${API_URL}/integrations`).then(r => { setActiveIntegrations((r.data.integrations ?? []).filter((i: any) => i.is_active)); }).catch(() => {}); }, []);
  useEffect(() => {
    const defaults: Record<string, boolean> = {}; const sev = form.severity;
    activeIntegrations.forEach(i => { if (i.category === "ticketing") defaults[i.type] = sev === "critical" || sev === "high"; else if (i.category === "communication") defaults[i.type] = sev !== "low"; });
    defaults["slack"] = sev === "critical" || sev === "high"; setActions(defaults);
  }, [form.severity, activeIntegrations]);
  const toggleAction = (key: string) => setActions(p => ({ ...p, [key]: !p[key] }));

  const submit = async () => {
    setSubmitted(true); if (!form.title.trim()) return; setSaving(true);
    try {
      const selectedActions = Object.entries(actions).filter(([_, v]) => v).map(([k]) => k);
      await axios.post(`${API_URL}/incidents`, { title: form.title, description: form.summary || null, severity: form.severity, source: "manual", environment: form.environment, assigned_to: form.assigned_to || null, actions: selectedActions.length > 0 ? selectedActions : null });
      onCreated();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const SEV_OPTIONS = [
    { key: "critical", label: "Critical", dot: "#E34935" }, { key: "high", label: "High", dot: "#E07B34" },
    { key: "medium", label: "Medium", dot: "#CF8A19" }, { key: "low", label: "Low", dot: "#22A06B" },
  ];
  const INTEGRATIONS: Record<string, { fg: string; label: string }> = {
    slack: { fg: "#E01E5A", label: "Slack channel" }, jira: { fg: "#0052CC", label: "Jira ticket" },
    teams: { fg: "#6264A7", label: "Teams notification" }, servicenow: { fg: "#008537", label: "ServiceNow ticket" },
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--b2)",
    background: "var(--s1)", color: "var(--t1)", fontSize: 14, outline: "none", transition: "border-color 0.15s",
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 6 }}>What's happening?</label>
        <input type="text" value={form.title} placeholder="Payment service is not responding" autoFocus
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={{ ...inputStyle, fontSize: 15, padding: "14px 16px", fontWeight: 500, borderColor: hasError ? "var(--re)" : "var(--b2)" }}
          onFocus={e => { if (!hasError) e.currentTarget.style.borderColor = "var(--t1)"; }}
          onBlur={e => { if (!hasError) e.currentTarget.style.borderColor = "var(--b2)"; }}
        />
        {hasError && <p style={{ fontSize: 12, color: "var(--re)", marginTop: 6 }}>This field is required</p>}
      </div>

      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 6 }}>
          Summary <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>optional</span>
        </label>
        <textarea value={form.summary} rows={3} placeholder="Describe the situation..."
          onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 80 }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 6 }}>Severity</label>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: SEV_OPTIONS.find(s => s.key === form.severity)?.dot || "#CF8A19" }} />
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              style={{ ...inputStyle, paddingLeft: 28, cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
              {SEV_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 6 }}>Environment</label>
          <div style={{ position: "relative" }}>
            <select value={form.environment} onChange={e => setForm(p => ({ ...p, environment: e.target.value }))}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
              <option value="prod">Production</option><option value="staging">Staging</option><option value="dev">Development</option>
            </select>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
          </div>
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 6 }}>
          Assignee <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>optional</span>
        </label>
        <input type="text" value={form.assigned_to} placeholder="Search team member..." onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
          style={inputStyle} onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
      </div>

      <div style={{ height: 1, background: "var(--b1)" }} />

      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 10 }}>Notifications & tickets</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ChipToggle label="Slack channel" color="#E01E5A" checked={actions["slack"] ?? false} onChange={() => toggleAction("slack")} />
          {activeIntegrations.map(i => { const s = INTEGRATIONS[i.type]; if (!s) return null; return <ChipToggle key={i.type} label={s.label} color={s.fg} checked={actions[i.type] ?? false} onChange={() => toggleAction(i.type)} />; })}
        </div>
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 8 }}>Auto-selected based on severity. You can change before declaring.</p>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t2)", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
        >Cancel</button>
        <button onClick={submit} disabled={saving} style={{
          padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer", border: "none",
          background: "var(--t1)", color: "#fff", opacity: saving ? 0.6 : 1, transition: "all 0.15s",
        }}>{saving ? "Declaring..." : "Declare"}</button>
      </div>
    </div>
  );
}

function ChipToggle({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
      border: checked ? `1.5px solid ${color}` : "1.5px solid var(--b2)", background: checked ? `${color}06` : "var(--s1)", transition: "all 0.15s",
    }}
      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; }}
      onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: checked ? color : "var(--b3)", transition: "background 0.15s" }} />
      <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? color : "var(--t2)", transition: "all 0.15s" }}>{label}</span>
    </button>
  );
}