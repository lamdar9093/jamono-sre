import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../config";

interface Incident {
  id: number; title: string; description: string | null; severity: string; status: string;
  source: string; environment: string; linked_pod: string | null; assigned_to: string | null;
  created_by: string; slack_channel: string | null; created_at: string; updated_at: string;
  resolved_at: string | null; mttr_seconds: number | null;
}
interface TimelineEntry { id: number; action: string; author: string; detail: string; timestamp: string; }
interface Link { id: number; integration_type: string; external_id: string; external_url: string; created_at: string; }

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: "#C13434", label: "Critical" }, high: { color: "#D85A30", label: "High" },
  medium: { color: "#B87514", label: "Medium" }, low: { color: "#2D8B5F", label: "Low" },
};
const STA: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: "var(--re)", bg: "var(--re-a)", label: "Ouvert" },
  in_progress: { color: "var(--am)", bg: "var(--am-a)", label: "En cours" },
  resolved: { color: "var(--g)", bg: "var(--g-a)", label: "Résolu" },
  watching: { color: "var(--bl)", bg: "var(--bl-a)", label: "Surveillance" },
};
const TL_COLOR: Record<string, string> = {
  created: "var(--brand)", status: "var(--am)", resolved: "var(--g)", assigned: "var(--bl)", comment: "var(--purple)",
};
const LINK_STYLE: Record<string, { fg: string; bg: string; border: string; label: string }> = {
  jira: { fg: "#0052CC", bg: "rgba(0,82,204,0.06)", border: "rgba(0,82,204,0.12)", label: "Jira" },
  servicenow: { fg: "#008537", bg: "rgba(0,133,55,0.06)", border: "rgba(0,133,55,0.12)", label: "ServiceNow" },
  github: { fg: "var(--t1)", bg: "var(--s2)", border: "var(--b2)", label: "GitHub" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtMttr(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

function StatusBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 8,
      fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
      cursor: "pointer", border: `1px solid ${color}25`,
      background: `${color}08`, color, transition: "all 0.12s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}08`; }}
    >{label}</button>
  );
}

function EscalateBtn({ label, desc, color, onClick, loading }: {
  label: string; desc: string; color: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: "flex", alignItems: "center", gap: 8, width: "100%",
      padding: "10px 12px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
      border: `1px dashed ${color}30`, background: "transparent",
      transition: "all 0.12s", opacity: loading ? 0.5 : 1,
    }}
      onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = `${color}04`; (e.currentTarget as HTMLElement).style.borderStyle = "solid"; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderStyle = "dashed"; }}
    >
      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}08`, border: `1px solid ${color}15`, display: "grid", placeItems: "center" }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
      </div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: color, fontWeight: 500 }}>{loading ? "Création..." : label}</div>
        <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>{desc}</div>
      </div>
    </button>
  );
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingJira, setCreatingJira] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/incidents/${id}`);
      setIncident(res.data.incident);
      setTimeline(res.data.timeline ?? []);
      const linkRes = await axios.get(`${API_URL}/incidents/${id}/links`);
      setLinks(linkRes.data.links ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const updateStatus = async (status: string) => {
    await axios.patch(`${API_URL}/incidents/${id}/status`, { status, detail: `Statut → ${status}` });
    fetchAll();
  };

  const createJira = async () => {
    setCreatingJira(true);
    try {
      await axios.post(`${API_URL}/incidents/${id}/ticket`, { integration_type: "jira" });
      fetchAll();
    } catch (e) { console.error(e); }
    finally { setCreatingJira(false); }
  };

  if (loading) return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <div style={{ width: 28, height: 28, border: "2.5px solid var(--b2)", borderTop: "2.5px solid var(--brand)", borderRadius: "50%", margin: "0 auto", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (!incident) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ fontFamily: "var(--fm)", fontSize: 13, color: "var(--t3)" }}>Incident introuvable</p>
      <button onClick={() => navigate("/incidents")} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--b2)", background: "transparent", color: "var(--brand)", cursor: "pointer", fontFamily: "var(--f)", fontSize: 12 }}>
        Retour aux incidents
      </button>
    </div>
  );

  const sev = SEV[incident.severity] || SEV.medium;
  const sta = STA[incident.status] || STA.open;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>

      {/* Back + header */}
      <div>
        <button onClick={() => navigate("/incidents")} style={{
          display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
          color: "var(--t3)", cursor: "pointer", fontFamily: "var(--fm)", fontSize: 11, padding: 0, marginBottom: 12,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4l-4 4 4 4"/>
          </svg>
          Retour aux incidents
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--fm)", fontSize: 13, color: "var(--t3)", fontWeight: 500 }}>#{incident.id}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6,
            fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600, color: sev.color, background: `${sev.color}10`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sev.color }} />
            {sev.label}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6,
            fontFamily: "var(--fm)", fontSize: 10, fontWeight: 500, color: sta.color, background: sta.bg,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sta.color }} />
            {sta.label}
          </span>
          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{timeAgo(incident.created_at)}</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", marginTop: 10 }}>
          {incident.title}
        </h1>
        {incident.description && (
          <p style={{ fontFamily: "var(--f)", fontSize: 14, color: "var(--t2)", marginTop: 8, lineHeight: 1.7 }}>
            {incident.description}
          </p>
        )}
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>

        {/* Left — Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status actions */}
          {incident.status !== "resolved" && (
            <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 10 }}>Actions</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {incident.status === "watching" && <StatusBtn label="Ouvrir" color="var(--sev-high)" onClick={() => updateStatus("open")} />}
                {(incident.status === "open" || incident.status === "watching") && <StatusBtn label="En cours" color="var(--am)" onClick={() => updateStatus("in_progress")} />}
                {incident.status !== "watching" && <StatusBtn label="Surveiller" color="var(--bl)" onClick={() => updateStatus("watching")} />}
                <StatusBtn label="Résoudre" color="var(--g)" onClick={() => updateStatus("resolved")} />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 14 }}>
              Timeline
            </div>
            {timeline.length === 0 ? (
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun événement</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {timeline.map((entry, i) => {
                  const dotColor = TL_COLOR[entry.action] || "var(--brand)";
                  return (
                    <div key={entry.id} style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 3, boxShadow: `0 0 6px ${dotColor}40` }} />
                        {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b2)", margin: "4px 0" }} />}
                      </div>
                      <div style={{ paddingBottom: 16, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: dotColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{entry.action}</span>
                          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{entry.author}</span>
                          <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginLeft: "auto" }}>{timeAgo(entry.timestamp)}</span>
                        </div>
                        {entry.detail && <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", marginTop: 4, lineHeight: 1.6 }}>{entry.detail}</p>}
                        <p style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 3 }}>{fmtDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Info card */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--b1)" }}>
              <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Détails</span>
            </div>
            {([
              ["Environnement", incident.environment],
              ["Pod / Service", incident.linked_pod || "—"],
              ["Assigné à", incident.assigned_to || "—"],
              ["Source", incident.source],
              ["Créé par", incident.created_by],
              ["Créé le", fmtDate(incident.created_at)],
              ["Mis à jour", fmtDate(incident.updated_at)],
              ...(incident.resolved_at ? [["Résolu le", fmtDate(incident.resolved_at)]] : []),
              ["MTTR", incident.mttr_seconds ? fmtMttr(incident.mttr_seconds) : "En cours..."],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 18px", borderBottom: "0.5px solid var(--b1)" }}>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>{k}</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", fontWeight: 500, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Escalade & canaux */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 10 }}>
              Escalade & canaux
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

              {/* Slack */}
              {incident.slack_channel ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 8,
                  background: "rgba(224,30,90,0.04)", border: "1px solid rgba(224,30,90,0.12)",
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(224,30,90,0.1)", display: "grid", placeItems: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="#E01E5A"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/><path d="M1.5 9.5A1.5 1.5 0 003 11h4V9.5A1.5 1.5 0 001.5 9.5z" opacity="0.8"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "#E01E5A", fontWeight: 600 }}>Canal Slack</div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{incident.slack_channel}</div>
                  </div>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "#2D8B5F", fontWeight: 600 }}>Actif</span>
                </div>
              ) : (
                <EscalateBtn label="Escalader sur Slack" desc="Créer un canal dédié" color="#E01E5A"
                  onClick={async () => {
                    await axios.post(`${API_URL}/incidents/${incident.id}/notify`, { channel: "slack" });
                    fetchAll();
                  }}
                />
              )}

              {/* Existing links (Jira, etc.) */}
              {links.map(link => {
                const ls = LINK_STYLE[link.integration_type] || LINK_STYLE.github;
                return (
                  <a key={link.id} href={link.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 8,
                    background: ls.bg, border: `1px solid ${ls.border}`,
                    textDecoration: "none", transition: "all 0.12s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ls.fg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ls.border; }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${ls.fg}10`, display: "grid", placeItems: "center", fontFamily: "var(--fm)", fontSize: 8, fontWeight: 700, color: ls.fg }}>{ls.label.slice(0, 3).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: ls.fg, fontWeight: 600 }}>{link.external_id}</div>
                      <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>{ls.label}</div>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={ls.fg} strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.5 }}>
                      <path d="M6 3h7v7M13 3L6 10"/>
                    </svg>
                  </a>
                );
              })}

              {/* Create Jira ticket if not linked */}
              {!links.some(l => l.integration_type === "jira") && (
                <EscalateBtn label="Créer un ticket Jira" desc="Ouvrir un ticket dans votre projet" color="#0052CC"
                  onClick={async () => { setCreatingJira(true); await createJira(); }}
                  loading={creatingJira}
                />
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
