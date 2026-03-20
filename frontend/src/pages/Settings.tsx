import { useState, useEffect, useRef, type ReactNode } from "react";
import axios from "axios";
import API_URL from "../config";

interface SettingsData { org_name: string; timezone: string; scan_mode: string; scan_interval_seconds: number; watched_namespace: string; auto_create_incidents: boolean; auto_create_min_severity: string; auto_assign: boolean; slack_enabled: boolean; slack_bot_token: string; slack_default_channel: string; slack_create_channel_per_incident: boolean; oncall_members: string[]; }

const inp: React.CSSProperties = { width: "100%", background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "var(--t1)", outline: "none", transition: "border-color 0.15s" };

const NAV = [
  { id: "general", label: "Général" },
  { id: "cluster", label: "Cluster K8s" },
  { id: "incidents", label: "Incidents" },
  { id: "slack", label: "Slack" },
  { id: "oncall", label: "On-Call" },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ position: "relative", width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: value ? "var(--t1)" : "var(--b3)", transition: "background 0.15s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "14px 20px", background: "var(--s1)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SectionCard({ id, title, desc, children }: { id: string; title: string; desc: string; children: ReactNode }) {
  return (
    <div id={`settings-${id}`} style={{ scrollMarginTop: 80 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{desc}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeNav, setActiveNav] = useState("general");
  const [showToken, setShowToken] = useState(false);
  const [newMember, setNewMember] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  useEffect(() => { axios.get(`${API_URL}/settings`).then(r => setSettings(r.data.settings)).catch(console.error).finally(() => setLoading(false)); }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollingRef.current) return;
      const sections = NAV.map(n => document.getElementById(`settings-${n.id}`));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i];
        if (el && el.getBoundingClientRect().top <= 120) { setActiveNav(NAV[i].id); break; }
      }
    };
    const main = contentRef.current?.closest("main");
    if (main) { main.addEventListener("scroll", handleScroll); return () => main.removeEventListener("scroll", handleScroll); }
  }, [loading]);

  const scrollTo = (id: string) => {
    setActiveNav(id);
    scrollingRef.current = true;
    setTimeout(() => { scrollingRef.current = false; }, 800);
    const el = document.getElementById(`settings-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async () => { if (!settings) return; setSaving(true); try { await axios.patch(`${API_URL}/settings`, { settings }); setSaved(true); setTimeout(() => setSaved(false), 3000); } catch (e) { console.error(e); } finally { setSaving(false); } };
  const upd = (key: keyof SettingsData, value: any) => { if (!settings) return; setSettings({ ...settings, [key]: value }); };
  const addMember = () => { if (!newMember.trim() || !settings) return; upd("oncall_members", [...settings.oncall_members, newMember.trim()]); setNewMember(""); };
  const removeMember = (i: number) => { if (!settings) return; upd("oncall_members", settings.oncall_members.filter((_, idx) => idx !== i)); };

  if (loading || !settings) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}><p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement...</p></div>;

  return (
    <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Paramètres</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>Configuration de la plateforme</p>
        </div>
        <button onClick={save} disabled={saving} style={{ padding: "8px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", border: "none", background: saved ? "var(--g)" : "var(--t1)", color: "#fff", opacity: saving ? 0.6 : 1, transition: "all 0.15s" }}>
          {saving ? "Sauvegarde..." : saved ? "✓ Sauvegardé" : "Sauvegarder"}
        </button>
      </div>

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 40 }}>
        {/* Left nav — sticky */}
        <div style={{ position: "sticky", top: 80, alignSelf: "start", display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => scrollTo(n.id)} style={{
              padding: "9px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "none",
              textAlign: "left", fontWeight: activeNav === n.id ? 600 : 400,
              background: activeNav === n.id ? "var(--s2)" : "transparent",
              color: activeNav === n.id ? "var(--t1)" : "var(--t3)",
              transition: "all 0.12s",
              borderLeft: activeNav === n.id ? "2px solid var(--t1)" : "2px solid transparent",
            }}
              onMouseEnter={e => { if (activeNav !== n.id) (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
              onMouseLeave={e => { if (activeNav !== n.id) (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
            >{n.label}</button>
          ))}
        </div>

        {/* Right content — all sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

          {/* Général */}
          <SectionCard id="general" title="Général" desc="Informations de base de votre organisation">
            <Row label="Nom de l'organisation" desc="Affiché dans l'interface et les notifications">
              <input type="text" value={settings.org_name} onChange={e => upd("org_name", e.target.value)} style={{ ...inp, width: 280 }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
            </Row>
            <Row label="Fuseau horaire" desc="Utilisé pour les timestamps et les notifications">
              <div style={{ position: "relative" }}>
                <select value={settings.timezone} onChange={e => upd("timezone", e.target.value)} style={{ ...inp, width: 280, cursor: "pointer", appearance: "none", WebkitAppearance: "none", paddingRight: 32 }}>
                  <option value="America/Toronto">America/Toronto (EST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="UTC">UTC</option>
                </select>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
              </div>
            </Row>
          </SectionCard>

          {/* Cluster */}
          <SectionCard id="cluster" title="Cluster Kubernetes" desc="Configuration du monitoring de votre cluster">
            <Row label="Mode de détection" desc="Manuel = scan à la demande · Auto = scan continu">
              <div style={{ display: "flex", gap: 4 }}>
                {[{ v: "manual", l: "Manuel" }, { v: "auto", l: "Auto" }, { v: "disabled", l: "Désactivé" }].map(m => (
                  <button key={m.v} onClick={() => upd("scan_mode", m.v)} style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "none",
                    fontWeight: settings.scan_mode === m.v ? 600 : 400,
                    background: settings.scan_mode === m.v ? "var(--t1)" : "var(--s2)",
                    color: settings.scan_mode === m.v ? "#fff" : "var(--t3)", transition: "all 0.12s",
                  }}>{m.l}</button>
                ))}
              </div>
            </Row>
            {settings.scan_mode === "auto" && (
              <Row label="Intervalle de scan" desc="Fréquence des scans automatiques">
                <div style={{ position: "relative" }}>
                  <select value={settings.scan_interval_seconds} onChange={e => upd("scan_interval_seconds", parseInt(e.target.value))} style={{ ...inp, width: 200, cursor: "pointer", appearance: "none", WebkitAppearance: "none", paddingRight: 32 }}>
                    <option value={30}>30 secondes</option><option value={60}>1 minute</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option>
                  </select>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
                </div>
              </Row>
            )}
            <Row label="Namespace surveillé" desc="Namespace par défaut pour les scans">
              <input type="text" value={settings.watched_namespace} onChange={e => upd("watched_namespace", e.target.value)} style={{ ...inp, width: 200 }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
            </Row>
          </SectionCard>

          {/* Incidents */}
          <SectionCard id="incidents" title="Incidents" desc="Automatisation de la gestion des incidents">
            <Row label="Création automatique" desc="Crée un incident dès qu'un pod passe UNHEALTHY">
              <Toggle value={settings.auto_create_incidents} onChange={v => upd("auto_create_incidents", v)} />
            </Row>
            {settings.auto_create_incidents && (
              <Row label="Sévérité minimale" desc="Seuil à partir duquel un incident est créé">
                <div style={{ position: "relative" }}>
                  <select value={settings.auto_create_min_severity} onChange={e => upd("auto_create_min_severity", e.target.value)} style={{ ...inp, width: 200, cursor: "pointer", appearance: "none", WebkitAppearance: "none", paddingRight: 32 }}>
                    <option value="low">Low et plus</option><option value="medium">Medium et plus</option><option value="high">High et plus</option><option value="critical">Critical seulement</option>
                  </select>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
                </div>
              </Row>
            )}
            <Row label="Assignation automatique" desc="Assigne au premier membre on-call disponible">
              <Toggle value={settings.auto_assign} onChange={v => upd("auto_assign", v)} />
            </Row>
          </SectionCard>

          {/* Slack */}
          <SectionCard id="slack" title="Notifications Slack" desc="Configurez les notifications Slack pour votre équipe">
            <Row label="Activer Slack" desc="Active les notifications et la création de canaux">
              <Toggle value={settings.slack_enabled} onChange={v => upd("slack_enabled", v)} />
            </Row>
            {settings.slack_enabled && (
              <>
                <Row label="Bot Token" desc="Token de votre application Slack (xoxb-...)">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type={showToken ? "text" : "password"} value={settings.slack_bot_token} onChange={e => upd("slack_bot_token", e.target.value)} placeholder="xoxb-..." style={{ ...inp, width: 260 }}
                      onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
                    <button onClick={() => setShowToken(!showToken)} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", fontSize: 12 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>{showToken ? "Masquer" : "Afficher"}</button>
                  </div>
                </Row>
                <Row label="Canal par défaut" desc="Canal utilisé si aucun canal dédié n'est créé">
                  <input type="text" value={settings.slack_default_channel} onChange={e => upd("slack_default_channel", e.target.value)} placeholder="#incidents" style={{ ...inp, width: 240 }}
                    onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
                </Row>
                <Row label="Canal par incident" desc="Crée un canal dédié pour chaque incident (ex: #incident-42)">
                  <Toggle value={settings.slack_create_channel_per_incident} onChange={v => upd("slack_create_channel_per_incident", v)} />
                </Row>
              </>
            )}
          </SectionCard>

          {/* On-Call */}
          <div id="settings-oncall" style={{ scrollMarginTop: 80 }}>
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Équipe On-Call</h2>
              <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>Membres disponibles pour les rotations d'astreinte</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {settings.oncall_members.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "var(--s2)", transition: "background 0.1s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--s3)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "var(--t2)", flexShrink: 0 }}>{m.charAt(0).toUpperCase()}</div>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--t1)", fontWeight: 500 }}>{m}</span>
                  <button onClick={() => removeMember(i)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--t3)", cursor: "pointer", display: "grid", placeItems: "center", transition: "all 0.12s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.background = "var(--re-a)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
                  </button>
                </div>
              ))}
              {settings.oncall_members.length === 0 && (
                <div style={{ padding: "28px 16px", textAlign: "center", border: "1px dashed var(--b2)", borderRadius: 10 }}>
                  <p style={{ fontSize: 13, color: "var(--t3)" }}>Aucun membre on-call configuré</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input type="text" value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="@username Slack" style={{ ...inp, flex: 1 }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }} onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }} />
                <button onClick={addMember} disabled={!newMember.trim()} style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !newMember.trim() ? "not-allowed" : "pointer", border: "none", background: "var(--t1)", color: "#fff", opacity: !newMember.trim() ? 0.4 : 1 }}>Ajouter</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}