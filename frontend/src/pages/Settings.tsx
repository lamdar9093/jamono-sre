import { useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import API_URL from "../config";

interface Settings {
  org_name: string;
  timezone: string;
  scan_mode: string;
  scan_interval_seconds: number;
  watched_namespace: string;
  auto_create_incidents: boolean;
  auto_create_min_severity: string;
  auto_assign: boolean;
  slack_enabled: boolean;
  slack_bot_token: string;
  slack_default_channel: string;
  slack_create_channel_per_incident: boolean;
  oncall_members: string[];
}

const inp: React.CSSProperties = {
  width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
  borderRadius: "var(--r)", padding: "6px 10px",
  fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", outline: "none",
};

function Section({ title, dot, children }: { title: string; dot?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderBottom: "1px solid var(--b1)" }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: dot || "var(--jam)", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", letterSpacing: "0.03em" }}>{label}</div>
        {desc && <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const on = Boolean(value);
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 36, height: 20,
        borderRadius: 10, border: "none", cursor: "pointer",
        background: on ? "var(--jam)" : "var(--b3)",
        transition: "background 0.15s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 19 : 3,
        width: 14, height: 14,
        borderRadius: "50%", background: "#fff",
        transition: "left 0.15s",
      }} />
    </button>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newMember, setNewMember] = useState("");

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then(r => setSettings(r.data.settings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/settings`, { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const upd = (key: keyof Settings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const addMember = () => {
    if (!newMember.trim() || !settings) return;
    upd("oncall_members", [...settings.oncall_members, newMember.trim()]);
    setNewMember("");
  };

  const removeMember = (i: number) => {
    if (!settings) return;
    upd("oncall_members", settings.oncall_members.filter((_, idx) => idx !== i));
  };

  if (loading || !settings) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.02em" }}>Paramètres</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            // Configuration de la plateforme
          </p>
        </div>
        <button onClick={save} disabled={saving} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 14px", borderRadius: 5,
          fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: saving ? "not-allowed" : "pointer",
          border: "none",
          background: saved ? "var(--g)" : "var(--jam)",
          color: "#fff", opacity: saving ? 0.7 : 1,
          transition: "all 0.15s",
        }}>
          {saving ? "Sauvegarde..." : saved ? "✓ Sauvegardé" : "Sauvegarder"}
        </button>
      </div>

      {/* Général */}
      <Section title="Général" dot="var(--bl)">
        <Field label="Nom de l'organisation">
          <input type="text" value={settings.org_name}
            onChange={e => upd("org_name", e.target.value)}
            style={{ ...inp, width: 200 }} />
        </Field>
        <Field label="Timezone">
          <select value={settings.timezone} onChange={e => upd("timezone", e.target.value)}
            style={{ ...inp, width: 220 }}>
            <option value="America/Toronto">America/Toronto (EST)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </Section>

      {/* Cluster */}
      <Section title="Cluster Kubernetes" dot="var(--g)">
        <Field label="Mode de détection" desc="Manuel = scan à la demande · Auto = scan en continu">
          <div style={{ display: "flex", gap: 4 }}>
            {[{ v: "manual", l: "Manuel" }, { v: "auto", l: "Auto" }, { v: "disabled", l: "Désactivé" }].map(m => (
              <button key={m.v} onClick={() => upd("scan_mode", m.v)} style={{
                padding: "4px 10px", borderRadius: 4,
                fontFamily: "var(--fm)", fontSize: 10, cursor: "pointer",
                border: settings.scan_mode === m.v ? "1px solid var(--jam-b)" : "1px solid var(--b2)",
                background: settings.scan_mode === m.v ? "var(--jam-a)" : "transparent",
                color: settings.scan_mode === m.v ? "var(--jam2)" : "var(--t3)",
                transition: "all 0.1s",
              }}>{m.l}</button>
            ))}
          </div>
        </Field>

        {settings.scan_mode === "auto" && (
          <Field label="Intervalle de scan">
            <select value={settings.scan_interval_seconds}
              onChange={e => upd("scan_interval_seconds", parseInt(e.target.value))}
              style={{ ...inp, width: 160 }}>
              <option value={30}>30 secondes</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
          </Field>
        )}

        <Field label="Namespace surveillé">
          <input type="text" value={settings.watched_namespace}
            onChange={e => upd("watched_namespace", e.target.value)}
            style={{ ...inp, width: 160 }} />
        </Field>
      </Section>

      {/* Incidents */}
      <Section title="Incidents" dot="var(--jam)">
        <Field label="Création automatique" desc="Crée un ticket dès qu'un pod passe UNHEALTHY">
          <Toggle value={settings.auto_create_incidents} onChange={v => upd("auto_create_incidents", v)} />
        </Field>

        {settings.auto_create_incidents && (
          <Field label="Sévérité minimale">
            <select value={settings.auto_create_min_severity}
              onChange={e => upd("auto_create_min_severity", e.target.value)}
              style={{ ...inp, width: 180 }}>
              <option value="low">Low et plus</option>
              <option value="medium">Medium et plus</option>
              <option value="high">High et plus</option>
              <option value="critical">Critical seulement</option>
            </select>
          </Field>
        )}

        <Field label="Assignation automatique" desc="Assigne au premier membre on-call disponible">
          <Toggle value={settings.auto_assign} onChange={v => upd("auto_assign", v)} />
        </Field>
      </Section>

      {/* Slack */}
      <Section title="Notifications Slack" dot="var(--g)">
        <Field label="Activer Slack">
          <Toggle value={settings.slack_enabled} onChange={v => upd("slack_enabled", v)} />
        </Field>

        {settings.slack_enabled && (
          <>
            <Field label="Bot Token" desc="Commence par xoxb- · api.slack.com/apps">
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={settings.slack_bot_token}
                  onChange={e => upd("slack_bot_token", e.target.value)}
                  placeholder="xoxb-..."
                  style={{ ...inp, width: 220 }}
                />
                <button onClick={() => setShowToken(!showToken)} style={{
                  padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                  border: "1px solid var(--b2)", background: "transparent",
                  color: "var(--t2)", fontFamily: "var(--fm)", fontSize: 11,
                }}>
                  {showToken ? "Masquer" : "Afficher"}
                </button>
              </div>
            </Field>

            <Field label="Canal par défaut">
              <input type="text" value={settings.slack_default_channel}
                onChange={e => upd("slack_default_channel", e.target.value)}
                placeholder="#incidents"
                style={{ ...inp, width: 180 }} />
            </Field>

            <Field label="Canal par incident" desc="Ex: #incident-42-crash-app2">
              <Toggle value={settings.slack_create_channel_per_incident}
                onChange={v => upd("slack_create_channel_per_incident", v)} />
            </Field>
          </>
        )}
      </Section>

      {/* On-Call */}
      <Section title="Équipe On-Call" dot="var(--am)">
        <Field label="Membres" desc="Usernames Slack des membres disponibles">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 260 }}>
            {settings.oncall_members.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  flex: 1, padding: "5px 10px",
                  background: "var(--s2)", border: "1px solid var(--b2)",
                  borderRadius: "var(--r)", fontFamily: "var(--fm)",
                  fontSize: 11, color: "var(--t2)",
                }}>
                  {m}
                </span>
                <button onClick={() => removeMember(i)} style={{
                  padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                  border: "1px solid var(--b2)", background: "transparent",
                  color: "var(--t3)", fontSize: 12,
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,56,56,0.3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}
                >✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text" value={newMember}
                onChange={e => setNewMember(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMember()}
                placeholder="@username"
                style={{ ...inp, flex: 1 }}
              />
              <button onClick={addMember} style={{
                padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                border: "1px solid var(--b2)", background: "transparent",
                color: "var(--t2)", fontFamily: "var(--fm)", fontSize: 14,
                transition: "all 0.1s",
              }}>+</button>
            </div>
          </div>
        </Field>
      </Section>

    </div>
  );
}