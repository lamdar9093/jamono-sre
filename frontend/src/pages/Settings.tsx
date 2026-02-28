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
  borderRadius: "var(--r)", padding: "8px 12px",
  fontFamily: "var(--fm)", fontSize: 12, color: "var(--t1)", outline: "none",
  transition: "border-color 0.15s",
};

function Section({ title, dot, children }: { title: string; dot?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--b1)" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot || "var(--brand)", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", letterSpacing: "0.02em" }}>{label}</div>
        {desc && <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>}
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
        position: "relative", width: 40, height: 22,
        borderRadius: 11, border: "none", cursor: "pointer",
        background: on ? "var(--brand)" : "var(--b3)",
        transition: "background 0.15s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        width: 16, height: 16,
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Paramètres</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>
            Configuration de la plateforme
          </p>
        </div>
        <button onClick={save} disabled={saving} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 18px", borderRadius: "var(--r)",
          fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          border: "none",
          background: saved ? "var(--g)" : "var(--brand)",
          color: "#fff", opacity: saving ? 0.7 : 1,
          boxShadow: saved ? "0 2px 10px rgba(52,211,153,0.3)" : "0 2px 10px rgba(59,130,246,0.3)",
          transition: "all 0.15s",
        }}>
          {saving ? "Sauvegarde..." : saved ? "✓ Sauvegardé" : "Sauvegarder"}
        </button>
      </div>

      <Section title="Général" dot="var(--bl)">
        <Field label="Nom de l'organisation">
          <input type="text" value={settings.org_name}
            onChange={e => upd("org_name", e.target.value)}
            style={{ ...inp, width: 220 }} />
        </Field>
        <Field label="Timezone">
          <select value={settings.timezone} onChange={e => upd("timezone", e.target.value)}
            style={{ ...inp, width: 240 }}>
            <option value="America/Toronto">America/Toronto (EST)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </Section>

      <Section title="Cluster Kubernetes" dot="var(--g)">
        <Field label="Mode de détection" desc="Manuel = scan à la demande · Auto = scan en continu">
          <div style={{ display: "flex", gap: 4 }}>
            {[{ v: "manual", l: "Manuel" }, { v: "auto", l: "Auto" }, { v: "disabled", l: "Désactivé" }].map(m => (
              <button key={m.v} onClick={() => upd("scan_mode", m.v)} style={{
                padding: "5px 12px", borderRadius: "var(--r)",
                fontFamily: "var(--fm)", fontSize: 11, cursor: "pointer",
                border: settings.scan_mode === m.v ? "1px solid var(--brand-b)" : "1px solid var(--b2)",
                background: settings.scan_mode === m.v ? "var(--brand-a)" : "transparent",
                color: settings.scan_mode === m.v ? "var(--brand2)" : "var(--t3)",
                fontWeight: settings.scan_mode === m.v ? 600 : 400,
                transition: "all 0.12s",
              }}>{m.l}</button>
            ))}
          </div>
        </Field>

        {settings.scan_mode === "auto" && (
          <Field label="Intervalle de scan">
            <select value={settings.scan_interval_seconds}
              onChange={e => upd("scan_interval_seconds", parseInt(e.target.value))}
              style={{ ...inp, width: 180 }}>
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
            style={{ ...inp, width: 180 }} />
        </Field>
      </Section>

      <Section title="Incidents" dot="var(--sev-high)">
        <Field label="Création automatique" desc="Crée un ticket dès qu'un pod passe UNHEALTHY">
          <Toggle value={settings.auto_create_incidents} onChange={v => upd("auto_create_incidents", v)} />
        </Field>

        {settings.auto_create_incidents && (
          <Field label="Sévérité minimale">
            <select value={settings.auto_create_min_severity}
              onChange={e => upd("auto_create_min_severity", e.target.value)}
              style={{ ...inp, width: 200 }}>
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

      <Section title="Notifications Slack" dot="var(--slack)">
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
                  style={{ ...inp, width: 240 }}
                />
                <button onClick={() => setShowToken(!showToken)} style={{
                  padding: "6px 12px", borderRadius: "var(--r)", cursor: "pointer",
                  border: "1px solid var(--b2)", background: "transparent",
                  color: "var(--t2)", fontFamily: "var(--fm)", fontSize: 11,
                  transition: "all 0.12s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {showToken ? "Masquer" : "Afficher"}
                </button>
              </div>
            </Field>

            <Field label="Canal par défaut">
              <input type="text" value={settings.slack_default_channel}
                onChange={e => upd("slack_default_channel", e.target.value)}
                placeholder="#incidents"
                style={{ ...inp, width: 200 }} />
            </Field>

            <Field label="Canal par incident" desc="Ex: #incident-42-crash-app2">
              <Toggle value={settings.slack_create_channel_per_incident}
                onChange={v => upd("slack_create_channel_per_incident", v)} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Équipe On-Call" dot="var(--am)">
        <Field label="Membres" desc="Usernames Slack des membres disponibles">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 280 }}>
            {settings.oncall_members.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  flex: 1, padding: "6px 12px",
                  background: "var(--s2)", border: "1px solid var(--b2)",
                  borderRadius: "var(--r)", fontFamily: "var(--fm)",
                  fontSize: 11, color: "var(--t2)",
                }}>
                  {m}
                </span>
                <button onClick={() => removeMember(i)} style={{
                  padding: "5px 8px", borderRadius: "var(--r)", cursor: "pointer",
                  border: "1px solid var(--b2)", background: "transparent",
                  color: "var(--t3)", fontSize: 12,
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.3)"; (e.currentTarget as HTMLElement).style.background = "var(--re-a)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
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
                padding: "6px 12px", borderRadius: "var(--r)", cursor: "pointer",
                border: "1px solid var(--b2)", background: "transparent",
                color: "var(--t2)", fontFamily: "var(--fm)", fontSize: 14,
                transition: "all 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >+</button>
            </div>
          </div>
        </Field>
      </Section>
    </div>
  );
}