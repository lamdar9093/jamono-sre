// Page paramètres — configuration générale, cluster, incidents, Slack et équipe on-call
import { useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import {
  Settings as Save, RefreshCw,
  Server, AlertTriangle, Slack, Users, Globe,
  CheckCircle, Eye, EyeOff, Plus, X,
} from "lucide-react";

const API_URL = "http://localhost:8000";

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

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newMember, setNewMember] = useState("");

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/settings`);
      setSettings(res.data.settings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/settings`, { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const addMember = () => {
    if (!newMember.trim() || !settings) return;
    update("oncall_members", [...settings.oncall_members, newMember.trim()]);
    setNewMember("");
  };

  const removeMember = (index: number) => {
    if (!settings) return;
    update("oncall_members", settings.oncall_members.filter((_, i) => i !== index));
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600 font-mono text-sm">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Paramètres</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Configuration de la plateforme Jamono</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm rounded transition-all font-mono"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> :
           saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      {/* Section Général */}
      <Section icon={<Globe size={15} />} title="Général">
        <Field label="Nom de l'organisation">
          <input
            type="text"
            value={settings.org_name}
            onChange={(e) => update("org_name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Timezone">
          <select
            value={settings.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            className={inputClass}
          >
            <option value="America/Toronto">America/Toronto (EST)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </Section>

      {/* Section Cluster */}
      <Section icon={<Server size={15} />} title="Cluster Kubernetes">
        <Field label="Mode de détection" description="Manuel = scan à la demande. Auto = scan en continu.">
          <div className="flex gap-2">
            {[
              { value: "manual", label: "Manuel" },
              { value: "auto", label: "Automatique" },
              { value: "disabled", label: "Désactivé" },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => update("scan_mode", m.value)}
                className={`px-4 py-2 rounded border text-xs font-mono transition-all ${
                  settings.scan_mode === m.value
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        {settings.scan_mode === "auto" && (
          <Field label="Intervalle de scan (secondes)">
            <select
              value={settings.scan_interval_seconds}
              onChange={(e) => update("scan_interval_seconds", parseInt(e.target.value))}
              className={inputClass}
            >
              <option value={30}>30 secondes</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
          </Field>
        )}

        <Field label="Namespace surveillé">
          <input
            type="text"
            value={settings.watched_namespace}
            onChange={(e) => update("watched_namespace", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* Section Incidents */}
      <Section icon={<AlertTriangle size={15} />} title="Incidents">
        <Field
          label="Création automatique de tickets"
          description="Crée un ticket dès qu'un pod passe UNHEALTHY"
        >
          <Toggle
            value={settings.auto_create_incidents}
            onChange={(v) => update("auto_create_incidents", v)}
          />
        </Field>

        {settings.auto_create_incidents && (
          <Field label="Sévérité minimale pour auto-création">
            <select
              value={settings.auto_create_min_severity}
              onChange={(e) => update("auto_create_min_severity", e.target.value)}
              className={inputClass}
            >
              <option value="low">Low et plus</option>
              <option value="medium">Medium et plus</option>
              <option value="high">High et plus</option>
              <option value="critical">Critical seulement</option>
            </select>
          </Field>
        )}

        <Field
          label="Assignation automatique"
          description="Assigne l'incident au premier membre on-call disponible"
        >
          <Toggle
            value={settings.auto_assign}
            onChange={(v) => update("auto_assign", v)}
          />
        </Field>
      </Section>

      {/* Section Slack */}
      <Section icon={<Slack size={15} />} title="Notifications Slack">
        <Field label="Activer Slack">
          <Toggle
            value={settings.slack_enabled}
            onChange={(v) => update("slack_enabled", v)}
          />
        </Field>

        {settings.slack_enabled && (
          <>
            <Field
              label="Bot Token"
              description="Commence par xoxb-. Créé dans api.slack.com/apps"
            >
              <div className="flex gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value={settings.slack_bot_token}
                  onChange={(e) => update("slack_bot_token", e.target.value)}
                  placeholder="xoxb-..."
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="px-3 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <Field label="Canal par défaut">
              <input
                type="text"
                value={settings.slack_default_channel}
                onChange={(e) => update("slack_default_channel", e.target.value)}
                placeholder="#incidents"
                className={inputClass}
              />
            </Field>

            <Field
              label="Créer un canal par incident"
              description="Ex: #incident-42-crash-app2"
            >
              <Toggle
                value={settings.slack_create_channel_per_incident}
                onChange={(v) => update("slack_create_channel_per_incident", v)}
              />
            </Field>
          </>
        )}
      </Section>

      {/* Section Équipe On-Call */}
      <Section icon={<Users size={15} />} title="Équipe On-Call">
        <Field
          label="Membres"
          description="Usernames Slack des membres disponibles pour les incidents"
        >
          <div className="space-y-2">
            {settings.oncall_members.map((member, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 font-mono">
                  {member}
                </span>
                <button
                  onClick={() => removeMember(i)}
                  className="p-2 rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                placeholder="@username"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={addMember}
                className="px-3 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </Field>
      </Section>

    </div>
  );
}

// Composants utilitaires
const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
        <span className="text-orange-500">{icon}</span>
        <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">{title}</span>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label className="text-xs text-zinc-400 font-mono uppercase tracking-wider">{label}</label>
        {description && <p className="text-xs text-zinc-600 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const isOn = Boolean(value) && value !== "false";
  return (
    <button
      onClick={() => onChange(!isOn)}
      className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${
        isOn ? "bg-orange-500" : "bg-zinc-700"
      }`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
        isOn ? "left-6" : "left-1"
      }`} />
    </button>
  );
}