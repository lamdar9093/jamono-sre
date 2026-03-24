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
const STA: Record<string, { color: string; label: string; icon: string }> = {
  open: { color: "var(--re)", label: "Ouvert", icon: "○" }, in_progress: { color: "var(--am)", label: "En cours", icon: "◔" },
  resolved: { color: "var(--g)", label: "Résolu", icon: "●" }, watching: { color: "var(--bl)", label: "Surveillance", icon: "◑" },
};
const TL_ICON: Record<string, { color: string; label: string }> = {
  created: { color: "var(--brand)", label: "Déclaré" }, status: { color: "var(--am)", label: "Statut modifié" },
  resolved: { color: "var(--g)", label: "Résolu" }, assigned: { color: "var(--bl)", label: "Assigné" },
  comment: { color: "var(--purple)", label: "Commentaire" },
};
const LINK_STYLE: Record<string, { fg: string; label: string }> = {
  jira: { fg: "#0052CC", label: "Jira" }, servicenow: { fg: "#008537", label: "ServiceNow" }, github: { fg: "var(--t1)", label: "GitHub" },
};

function fmtDateShort(iso: string) { return new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fmtMttr(s: number) { if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }
function duration(from: string, to?: string | null) {
  const ms = ((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24); return `${d}j ${h % 24}h`;
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "postmortem">("overview");
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

  const updateStatus = async (status: string) => {
    await axios.patch(`${API_URL}/incidents/${id}/status`, { status, detail: `Statut → ${status}` }); fetchAll();
  };
  const createJira = async () => {
    setCreatingJira(true);
    try { await axios.post(`${API_URL}/incidents/${id}/ticket`, { integration_type: "jira" }); fetchAll(); }
    catch (e) { console.error(e); } finally { setCreatingJira(false); }
  };

  if (loading) return (
    <div style={{ padding: "80px 0", textAlign: "center" }}>
      <div style={{ width: 28, height: 28, border: "2.5px solid var(--b2)", borderTop: "2.5px solid var(--t1)", borderRadius: "50%", margin: "0 auto", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  if (!incident) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <p style={{ fontSize: 15, color: "var(--t3)", marginBottom: 16 }}>Incident introuvable</p>
      <button onClick={() => navigate("/incidents")} style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t2)", cursor: "pointer", fontSize: 13 }}>
        Retour aux incidents
      </button>
    </div>
  );

  const sev = SEV[incident.severity] || SEV.medium;
  const sta = STA[incident.status] || STA.open;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Breadcrumb + Slack button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <button onClick={() => navigate("/incidents")} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 13, padding: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}>
            Incidents
          </button>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
          <span style={{ color: "var(--t1)", fontWeight: 600 }}>INC-{incident.id}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {incident.slack_channel ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#E01E5A", background: "rgba(224,30,90,0.05)", border: "1px solid rgba(224,30,90,0.12)" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#E01E5A"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/></svg>
              {incident.slack_channel}
            </span>
          ) : (
            <button onClick={async () => { await axios.post(`${API_URL}/incidents/${incident.id}/notify`, { channel: "slack" }); fetchAll(); }} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: "pointer", border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t2)", transition: "all 0.12s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#E01E5A"><path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/></svg>
              Canal Slack
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>{incident.title}</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--b1)", marginTop: 16, marginBottom: 24 }}>
        {(["overview", "postmortem"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 20px", fontSize: 14, cursor: "pointer", border: "none", background: "transparent",
            fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--t1)" : "var(--t3)",
            borderBottom: tab === t ? "2px solid var(--t1)" : "2px solid transparent",
            marginBottom: -1, transition: "all 0.12s",
          }}>
            {t === "overview" ? "Aperçu" : "Post-incident"}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 32 }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {incident.description && (
              <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>{incident.description}</p>
            )}

            {/* Action buttons */}
            {incident.status !== "resolved" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {incident.status === "open" && (
                  <ActionChip icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1"/></svg>} label="Prendre en charge" onClick={() => updateStatus("in_progress")} />
                )}
                {incident.status === "in_progress" && (
                  <ActionChip icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3.5-4"/></svg>} label="Marquer résolu" onClick={() => updateStatus("resolved")} />
                )}
                {incident.status === "watching" && (
                  <ActionChip icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2L14 13H2L8 2z"/></svg>} label="Rouvrir" onClick={() => updateStatus("open")} />
                )}
                {incident.status !== "watching" && incident.status !== "resolved" && (
                  <ActionChip icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 8a7 7 0 0114 0 7 7 0 01-14 0z"/><circle cx="8" cy="8" r="2"/></svg>} label="Surveiller" onClick={() => updateStatus("watching")} />
                )}
              </div>
            )}

            {/* Activity */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 16 }}>Activité</h3>

              {timeline.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--t3)", padding: "20px 0" }}>Aucun événement enregistré</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {(() => {
                    let lastDate = "";
                    return timeline.map((entry, i) => {
                      const entryDate = new Date(entry.timestamp).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                      const showDate = entryDate !== lastDate;
                      lastDate = entryDate;
                      const tl = TL_ICON[entry.action] || { color: "var(--brand)", label: entry.action };
                      const time = new Date(entry.timestamp).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

                      return (
                        <div key={entry.id}>
                          {showDate && (
                            <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 500, padding: "12px 0 8px", textTransform: "capitalize" }}>
                              {entryDate}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 12, paddingLeft: 4 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tl.color, flexShrink: 0, marginTop: 5 }} />
                              {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--b1)", margin: "4px 0" }} />}
                            </div>
                            <div style={{ paddingBottom: 18, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500, width: 40 }}>{time}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: tl.color }}>{tl.label}</span>
                                {entry.author && entry.author !== "system" && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--t3)" }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--s3)", display: "inline-grid", placeItems: "center", fontSize: 9, fontWeight: 600, color: "var(--t2)" }}>{entry.author.charAt(0).toUpperCase()}</span>
                                    {entry.author}
                                  </span>
                                )}
                              </div>
                              {entry.detail && (
                                <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, lineHeight: 1.6, paddingLeft: 46, borderLeft: "2px solid var(--b1)", marginLeft: -34 }}>
                                  {entry.detail}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, borderLeft: "1px solid var(--b1)", paddingLeft: 24 }}>

            <PanelSection title="Propriétés">
              <PropRow label="Statut">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: sta.color }}>
                  <span style={{ fontSize: 12 }}>{sta.icon}</span> {sta.label}
                </span>
              </PropRow>
              <PropRow label="Sévérité">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: sev.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sev.color }} /> {sev.label}
                </span>
              </PropRow>
              <PropRow label="Déclaré le">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--t1)" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg>
                  {fmtDateShort(incident.created_at)}
                </span>
              </PropRow>
              <PropRow label="Durée">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--t1)" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2 1.5"/></svg>
                  {duration(incident.created_at, incident.resolved_at)}
                </span>
              </PropRow>
              {incident.environment && (
                <PropRow label="Environnement">
                  <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, color: incident.environment === "prod" ? "var(--sev-high)" : "var(--bl)", background: incident.environment === "prod" ? "var(--sev-high-a)" : "var(--bl-a)" }}>{incident.environment}</span>
                </PropRow>
              )}
            </PanelSection>

            <PanelSection title="Rôles">
              <PropRow label="Responsable">
                {incident.assigned_to ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--t1)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--s3)", display: "inline-grid", placeItems: "center", fontSize: 10, fontWeight: 600, color: "var(--t2)" }}>{incident.assigned_to.charAt(0).toUpperCase()}</span>
                    {incident.assigned_to}
                  </span>
                ) : (
                  <button style={{ fontSize: 12, color: "var(--bl)", background: "none", border: "none", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 14a5 5 0 0110 0"/></svg>
                    Assigner
                  </button>
                )}
              </PropRow>
              <PropRow label="Déclaré par">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--t1)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--brand-a)", display: "inline-grid", placeItems: "center", fontSize: 10, fontWeight: 600, color: "var(--brand)" }}>{incident.created_by?.charAt(0).toUpperCase() || "?"}</span>
                  {incident.created_by || "Système"}
                </span>
              </PropRow>
              <PropRow label="Source">
                <span style={{ fontSize: 13, color: "var(--t1)" }}>{incident.source === "auto" ? "Automatique" : incident.source === "watch" ? "Surveillance" : "Manuel"}</span>
              </PropRow>
            </PanelSection>

            <PanelSection title="Liens">
              {incident.linked_pod && (
                <PropRow label="Pod / Service">
                  <span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{incident.linked_pod}</span>
                </PropRow>
              )}
              {links.map(link => {
                const ls = LINK_STYLE[link.integration_type] || LINK_STYLE.github;
                return (
                  <PropRow key={link.id} label={ls.label}>
                    <a href={link.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ls.fg, fontWeight: 600, textDecoration: "none" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
                      {link.external_id}
                    </a>
                  </PropRow>
                );
              })}
              {!links.some(l => l.integration_type === "jira") && (
                <PropRow label="Jira">
                  <button onClick={createJira} disabled={creatingJira} style={{ fontSize: 12, color: "#0052CC", background: "none", border: "none", cursor: creatingJira ? "not-allowed" : "pointer", fontWeight: 500, opacity: creatingJira ? 0.5 : 1 }}>
                    {creatingJira ? "Création..." : "Créer un ticket"}
                  </button>
                </PropRow>
              )}
              <PropRow label="Incidents liés">
                <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>
              </PropRow>
            </PanelSection>

            <PanelSection title="Chronologie">
              <PropRow label="Créé">{fmtDateShort(incident.created_at)}</PropRow>
              <PropRow label="Mis à jour">{fmtDateShort(incident.updated_at)}</PropRow>
              {incident.resolved_at && <PropRow label="Résolu">{fmtDateShort(incident.resolved_at)}</PropRow>}
              <PropRow label="MTTR">
                <span style={{ fontWeight: 500, color: incident.mttr_seconds ? "var(--g)" : "var(--am)" }}>
                  {incident.mttr_seconds ? fmtMttr(incident.mttr_seconds) : "En cours"}
                </span>
              </PropRow>
            </PanelSection>

          </div>
        </div>
      ) : (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1" strokeLinecap="round" style={{ opacity: 0.3, marginBottom: 16 }}>
            <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 8h4M5 10h5"/>
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Post-incident</p>
          <p style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            Le rapport post-incident sera disponible après la résolution. Documentez les causes, les actions correctives et les leçons apprises.
          </p>
        </div>
      )}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{children}</div>
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--b1)" }}>
      <span style={{ fontSize: 13, color: "var(--t3)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--t1)" }}>{children}</span>
    </div>
  );
}

function ActionChip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8,
      fontSize: 13, fontWeight: 500, cursor: "pointer",
      border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t1)", transition: "all 0.12s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}>
      {icon}
      {label}
    </button>
  );
}