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
  critical: { color: "var(--sev-critical)", label: "Critical" }, high: { color: "var(--sev-high)", label: "High" },
  medium: { color: "var(--sev-medium)", label: "Medium" }, low: { color: "var(--sev-low)", label: "Low" },
};
const STA: Record<string, { color: string; label: string }> = {
  open: { color: "var(--re)", label: "Ouvert" }, in_progress: { color: "var(--am)", label: "En cours" },
  resolved: { color: "var(--g)", label: "Résolu" }, watching: { color: "var(--bl)", label: "Surveillance" },
};
const TL_COLOR: Record<string, string> = { created: "var(--brand)", status: "var(--am)", resolved: "var(--g)", assigned: "var(--bl)", comment: "var(--purple)" };
const LINK_STYLE: Record<string, { fg: string; label: string }> = {
  jira: { fg: "#0052CC", label: "Jira" }, servicenow: { fg: "#008537", label: "ServiceNow" }, github: { fg: "var(--t1)", label: "GitHub" },
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function fmtMttr(s: number) { if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }
function timeAgo(d: string) { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)}min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`; return `il y a ${Math.floor(s / 86400)}j`; }

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
      setIncident(res.data.incident); setTimeline(res.data.timeline ?? []);
      const linkRes = await axios.get(`${API_URL}/incidents/${id}/links`);
      setLinks(linkRes.data.links ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, [id]);

  const updateStatus = async (status: string) => { await axios.patch(`${API_URL}/incidents/${id}/status`, { status, detail: `Statut → ${status}` }); fetchAll(); };
  const createJira = async () => { setCreatingJira(true); try { await axios.post(`${API_URL}/incidents/${id}/ticket`, { integration_type: "jira" }); fetchAll(); } catch (e) { console.error(e); } finally { setCreatingJira(false); } };

  if (loading) return <div style={{ padding: "60px 0", textAlign: "center" }}><div style={{ width: 28, height: 28, border: "2.5px solid var(--b2)", borderTop: "2.5px solid var(--t1)", borderRadius: "50%", margin: "0 auto", animation: "spin 0.7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  if (!incident) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ fontSize: 14, color: "var(--t3)" }}>Incident introuvable</p><button onClick={() => navigate("/incidents")} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", cursor: "pointer", fontSize: 13 }}>Retour aux incidents</button></div>;

  const sev = SEV[incident.severity] || SEV.medium;
  const sta = STA[incident.status] || STA.open;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 960 }}>
      {/* Back + header */}
      <div>
        <button onClick={() => navigate("/incidents")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4l-4 4 4 4"/></svg>
          Retour aux incidents
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--t3)", fontWeight: 500 }}>#{incident.id}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sev.color, background: `${sev.color}10` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sev.color }} /> {sev.label}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sta.color, background: `${sta.color}08` }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sta.color }} /> {sta.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>{timeAgo(incident.created_at)}</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", marginTop: 10 }}>{incident.title}</h1>
        {incident.description && <p style={{ fontSize: 14, color: "var(--t2)", marginTop: 8, lineHeight: 1.7 }}>{incident.description}</p>}
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Actions */}
          {incident.status !== "resolved" && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Actions</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {incident.status === "watching" && <Btn label="Ouvrir" color="var(--sev-high)" onClick={() => updateStatus("open")} />}
                {(incident.status === "open" || incident.status === "watching") && <Btn label="En cours" color="var(--am)" onClick={() => updateStatus("in_progress")} />}
                {incident.status !== "watching" && <Btn label="Surveiller" color="var(--bl)" onClick={() => updateStatus("watching")} />}
                <Btn label="Résoudre" color="var(--g)" onClick={() => updateStatus("resolved")} />
              </div>
            </div>
          )}
          {/* Timeline */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 14 }}>Activité</h3>
            {timeline.length === 0 ? <p style={{ fontSize: 13, color: "var(--t3)" }}>Aucun événement</p> : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {timeline.map((entry, i) => {
                  const dc = TL_COLOR[entry.action] || "var(--brand)";
                  return (
                    <div key={entry.id} style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dc, flexShrink: 0, marginTop: 4 }} />
                        {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b1)", margin: "4px 0" }} />}
                      </div>
                      <div style={{ paddingBottom: 18, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: dc, fontWeight: 600 }}>{entry.action}</span>
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>{entry.author}</span>
                          <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>{timeAgo(entry.timestamp)}</span>
                        </div>
                        {entry.detail && <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, lineHeight: 1.6 }}>{entry.detail}</p>}
                        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{fmtDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Properties */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Propriétés</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 10, overflow: "hidden" }}>
              {([
                ["Environnement", incident.environment], ["Pod / Service", incident.linked_pod || "—"],
                ["Assigné à", incident.assigned_to || "—"], ["Source", incident.source],
                ["Créé par", incident.created_by], ["Créé le", fmtDate(incident.created_at)],
                ["Mis à jour", fmtDate(incident.updated_at)],
                ...(incident.resolved_at ? [["Résolu le", fmtDate(incident.resolved_at)]] : []),
                ["MTTR", incident.mttr_seconds ? fmtMttr(incident.mttr_seconds) : "En cours..."],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "var(--s1)" }}>
                  <span style={{ fontSize: 13, color: "var(--t3)" }}>{k}</span>
                  <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Escalade & canaux */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Escalade & canaux</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Slack */}
              {incident.slack_channel ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, background: "rgba(224,30,90,0.03)", border: "1px solid rgba(224,30,90,0.10)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(224,30,90,0.08)", display: "grid", placeItems: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="#E01E5A"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/><path d="M1.5 9.5A1.5 1.5 0 003 11h4V9.5A1.5 1.5 0 001.5 9.5z" opacity="0.8"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#E01E5A", fontWeight: 600 }}>Canal Slack</div>
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>{incident.slack_channel}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--g)", fontWeight: 500 }}>Actif</span>
                </div>
              ) : (
                <EscBtn label="Escalader sur Slack" desc="Créer un canal dédié" color="#E01E5A" onClick={async () => { await axios.post(`${API_URL}/incidents/${incident.id}/notify`, { channel: "slack" }); fetchAll(); }} />
              )}
              {/* Existing links */}
              {links.map(link => {
                const ls = LINK_STYLE[link.integration_type] || LINK_STYLE.github;
                return (
                  <a key={link.id} href={link.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8,
                    background: `${ls.fg}04`, border: `1px solid ${ls.fg}10`, textDecoration: "none", transition: "all 0.12s",
                  }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ls.fg}25`; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ls.fg}10`; }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${ls.fg}08`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: ls.fg }}>{ls.label.slice(0, 3).toUpperCase()}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: ls.fg, fontWeight: 600 }}>{link.external_id}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{ls.label}</div></div>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={ls.fg} strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4 }}><path d="M6 3h7v7M13 3L6 10"/></svg>
                  </a>
                );
              })}
              {/* Create Jira */}
              {!links.some(l => l.integration_type === "jira") && (
                <EscBtn label="Créer un ticket Jira" desc="Ouvrir un ticket dans votre projet" color="#0052CC" onClick={async () => { setCreatingJira(true); await createJira(); }} loading={creatingJira} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1px solid ${color}20`, background: `${color}06`, color, transition: "all 0.12s" }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}14`; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}06`; }}>{label}</button>;
}

function EscBtn({ label, desc, color, onClick, loading }: { label: string; desc: string; color: string; onClick: () => void; loading?: boolean }) {
  return <button onClick={onClick} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", border: `1px dashed ${color}25`, background: "transparent", transition: "all 0.12s", opacity: loading ? 0.5 : 1 }}
    onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = `${color}03`; (e.currentTarget as HTMLElement).style.borderStyle = "solid"; } }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderStyle = "dashed"; }}>
    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}06`, display: "grid", placeItems: "center" }}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
    </div>
    <div style={{ flex: 1, textAlign: "left" }}><div style={{ fontSize: 13, color, fontWeight: 500 }}>{loading ? "Création..." : label}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{desc}</div></div>
  </button>;
}