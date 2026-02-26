// Page incidents — liste, création manuelle/watch et détail avec timeline
import { useState, useEffect } from "react";
import axios from "axios";
import type { Incident, TimelineEntry, MttrStats } from "../types";
import {
  AlertTriangle, CheckCircle, Clock, Eye, Plus,
  RefreshCw, X, Activity, Filter, Shield,
} from "lucide-react";
import API_URL from "../config";

const severityConfig: Record<string, { label: string; color: string }> = {
  low:      { label: "LOW",      color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  medium:   { label: "MEDIUM",   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  high:     { label: "HIGH",     color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  critical: { label: "CRITICAL", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  watching:    { label: "Surveillance", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Eye },
  open:        { label: "Ouvert",       color: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
  in_progress: { label: "En cours",     color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Activity },
  resolved:    { label: "Résolu",       color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
};

function formatMttr(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit"
  });
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<MttrStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  useEffect(() => { fetchIncidents(); }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/incidents`);
      setIncidents(res.data.incidents);
      setStats(res.data.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (incident: Incident) => {
    setSelectedIncident(incident);
    const res = await axios.get(`${API_URL}/incidents/${incident.id}`);
    setTimeline(res.data.timeline);
  };

  const updateStatus = async (incidentId: number, status: string) => {
    await axios.patch(`${API_URL}/incidents/${incidentId}/status`, {
      status, detail: `Statut changé → ${status}`
    });
    await fetchIncidents();
    if (selectedIncident?.id === incidentId) {
      const res = await axios.get(`${API_URL}/incidents/${incidentId}`);
      setSelectedIncident(res.data.incident);
      setTimeline(res.data.timeline);
    }
  };

  const filtered = incidents.filter(i => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterEnv !== "all" && i.environment !== filterEnv) return false;
    return true;
  });

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Incidents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestion du cycle de vie des incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchIncidents}
            className="flex items-center gap-2 px-3 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm font-mono transition-all"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm rounded transition-all font-mono"
          >
            <Plus size={15} />
            Créer un incident
          </button>
        </div>
      </div>

      {/* Stats MTTR */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total incidents", value: stats.total, color: "text-zinc-100" },
            { label: "Résolus", value: stats.resolved, color: "text-green-400" },
            { label: "MTTR moyen", value: stats.avg_mttr_seconds ? formatMttr(stats.avg_mttr_seconds) : "—", color: "text-orange-400" },
            { label: "Meilleur MTTR", value: stats.min_mttr_seconds ? formatMttr(stats.min_mttr_seconds) : "—", color: "text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={13} className="text-zinc-600" />
        <div className="flex gap-2">
          {["all", "watching", "open", "in_progress", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded text-xs font-mono transition-all border ${
                filterStatus === s
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                  : "text-zinc-500 hover:text-zinc-300 border-transparent"
              }`}
            >
              {s === "all" ? "Tous" : statusConfig[s]?.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-zinc-800" />
        <div className="flex gap-2">
          {["all", "prod", "staging", "dev"].map((e) => (
            <button
              key={e}
              onClick={() => setFilterEnv(e)}
              className={`px-3 py-1 rounded text-xs font-mono transition-all border ${
                filterEnv === e
                  ? "bg-zinc-700 text-zinc-300 border-zinc-600"
                  : "text-zinc-500 hover:text-zinc-300 border-transparent"
              }`}
            >
              {e === "all" ? "Tous envs" : e}
            </button>
          ))}
        </div>
      </div>

      {/* Liste incidents */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
          <AlertTriangle size={15} className="text-orange-500" />
          <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
            {filtered.length} incident{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Shield size={32} className="text-zinc-700" />
            <p className="text-zinc-600 font-mono text-sm">Aucun incident</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map((incident) => {
              const sev = severityConfig[incident.severity];
              const status = statusConfig[incident.status];
              const StatusIcon = status?.icon || AlertTriangle;

              return (
                <div
                  key={incident.id}
                  onClick={() => openDetail(incident)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/50 cursor-pointer transition-all"
                >
                  {/* ID */}
                  <span className="text-xs text-zinc-600 font-mono w-10 shrink-0">
                    #{incident.id}
                  </span>

                  {/* Sévérité */}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border w-20 text-center shrink-0 ${sev?.color}`}>
                    {sev?.label}
                  </span>

                  {/* Titre + pod */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100 font-medium truncate">{incident.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {incident.linked_pod && (
                        <span className="text-xs text-zinc-500 font-mono">{incident.linked_pod}</span>
                      )}
                      <span className="text-xs text-zinc-600 font-mono">{incident.environment}</span>
                      <span className="text-xs text-zinc-600 font-mono">
                        {incident.source === "auto" ? "🤖 auto" : incident.source === "watch" ? "👁 watch" : "👤 manuel"}
                      </span>
                    </div>
                  </div>

                  {/* Assigné */}
                  <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono w-24 shrink-0">
                    <Shield size={10} />
                    <span className="truncate">{incident.assigned_to || "Non assigné"}</span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1 text-xs text-zinc-600 font-mono w-28 shrink-0">
                    <Clock size={10} />
                    <span>{formatDate(incident.created_at)}</span>
                  </div>

                  {/* Statut */}
                  <span className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border w-28 shrink-0 ${status?.color}`}>
                    <StatusIcon size={10} />
                    {status?.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer détail incident */}
      {selectedIncident && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSelectedIncident(null)} />
          <div className="fixed top-0 right-0 h-full w-2/5 bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-zinc-300 font-bold">
                  Incident #{selectedIncident.id}
                </span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${severityConfig[selectedIncident.severity]?.color}`}>
                  {severityConfig[selectedIncident.severity]?.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-5">

              {/* Titre */}
              <div>
                <p className="text-lg font-bold text-zinc-100">{selectedIncident.title}</p>
                {selectedIncident.description && (
                  <p className="text-sm text-zinc-400 mt-1">{selectedIncident.description}</p>
                )}
              </div>

              {/* Infos */}
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {[
                  { label: "Statut", value: statusConfig[selectedIncident.status]?.label },
                  { label: "Environnement", value: selectedIncident.environment },
                  { label: "Pod lié", value: selectedIncident.linked_pod || "—" },
                  { label: "Assigné à", value: selectedIncident.assigned_to || "Non assigné" },
                  { label: "Créé par", value: selectedIncident.created_by },
                  { label: "Créé le", value: formatDate(selectedIncident.created_at) },
                  { label: "MTTR", value: selectedIncident.mttr_seconds ? formatMttr(selectedIncident.mttr_seconds) : "En cours..." },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-xs text-zinc-500 font-mono">{label}</span>
                    <span className="text-xs text-zinc-300 font-mono font-bold">{value}</span>
                  </div>
                ))}
              </div>

              {/* Actions statut */}
              {selectedIncident.status !== "resolved" && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Changer le statut</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedIncident.status === "watching" && (
                      <button
                        onClick={() => updateStatus(selectedIncident.id, "open")}
                        className="px-3 py-1.5 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs font-mono transition-all"
                      >
                        → Ouvrir
                      </button>
                    )}
                    {(selectedIncident.status === "open" || selectedIncident.status === "watching") && (
                      <button
                        onClick={() => updateStatus(selectedIncident.id, "in_progress")}
                        className="px-3 py-1.5 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs font-mono transition-all"
                      >
                        → En cours
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(selectedIncident.id, "resolved")}
                      className="px-3 py-1.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs font-mono transition-all"
                    >
                      → Résoudre
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-3">Timeline</p>
                <div className="space-y-3">
                  {timeline.map((entry, i) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1" />
                        {i < timeline.length - 1 && (
                          <div className="w-px flex-1 bg-zinc-800 mt-1" />
                        )}
                      </div>
                      <div className="pb-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-300 font-mono font-bold">{entry.action}</span>
                          <span className="text-xs text-zinc-600 font-mono">{entry.author}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{entry.detail}</p>
                        <p className="text-xs text-zinc-700 font-mono mt-0.5">{formatDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal création */}
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchIncidents(); }}
        />
      )}
    </div>
  );
}

// Modal de création d'incident
function CreateIncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    source: "manual",
    environment: "prod",
    linked_pod: "",
    assigned_to: "",
    watch_minutes: 15,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
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
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Plus size={15} className="text-orange-500" />
              <span className="text-sm font-mono text-zinc-200 font-bold uppercase tracking-wide">
                Créer un incident
              </span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
              <X size={15} />
            </button>
          </div>

          <div className="p-6 space-y-4">

            {/* Type d'incident */}
            <div>
              <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Type
              </label>
              <div className="flex gap-2">
                {[
                  { value: "manual", label: "👤 Manuel" },
                  { value: "watch",  label: "👁 Surveillance" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, source: t.value })}
                    className={`flex-1 py-2 rounded border text-xs font-mono transition-all ${
                      form.source === t.value
                        ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Watch timer */}
            {form.source === "watch" && (
              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                  Timer de surveillance (minutes)
                </label>
                <input
                  type="number"
                  value={form.watch_minutes}
                  onChange={(e) => setForm({ ...form, watch_minutes: parseInt(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Si non résolu dans ce délai → incident ouvert automatiquement
                </p>
              </div>
            )}

            {/* Titre */}
            <div>
              <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Titre *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: API gateway timeout en prod"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 placeholder-zinc-700"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Décris le problème observé..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 placeholder-zinc-700 resize-none"
              />
            </div>

            {/* Sévérité + Environnement */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                  Sévérité
                </label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                  Environnement
                </label>
                <select
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
                >
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                  <option value="dev">Dev</option>
                </select>
              </div>
            </div>

            {/* Pod lié + Assigné */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                  Pod lié (optionnel)
                </label>
                <input
                  type="text"
                  value={form.linked_pod}
                  onChange={(e) => setForm({ ...form, linked_pod: e.target.value })}
                  placeholder="crash-app2"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 placeholder-zinc-700"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                  Assigné à
                </label>
                <input
                  type="text"
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  placeholder="@username"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 placeholder-zinc-700"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm font-mono transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.title.trim()}
                className="flex-1 py-2.5 rounded bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm font-mono transition-all"
              >
                {saving ? "Création..." : "Créer l'incident"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}