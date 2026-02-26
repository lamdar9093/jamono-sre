// Page historique — affiche tous les actions de remédiation avec leur statut et contexte
import { useState, useEffect } from "react";
import axios from "axios";
import {
  History as HistoryIcon,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  RefreshCw,
  Shield,
  Loader2,
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface AuditEntry {
  id: number;
  timestamp: string;
  pod_name: string;
  action_type: string;
  change_before: string;
  change_after: string;
  approved_by: string;
  status: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  success: { label: "Succès", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
  failed: { label: "Échec", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
  rolled_back: { label: "Rollback", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", icon: RotateCcw },
  pending: { label: "En attente", color: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: Clock },
};

export default function History() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/audit`);
      setLogs(res.data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-CA", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Historique</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Journal complet des actions de remédiation
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 text-sm font-mono transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total actions", value: logs.length, color: "text-zinc-100" },
          { label: "Succès", value: logs.filter(l => l.status === "success").length, color: "text-green-400" },
          { label: "Échecs", value: logs.filter(l => l.status === "failed").length, color: "text-red-400" },
          { label: "Rollbacks", value: logs.filter(l => l.status === "rolled_back").length, color: "text-zinc-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">

        {/* Header table */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
          <HistoryIcon size={15} className="text-orange-500" />
          <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
            Journal d'audit
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-600">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-mono">Chargement...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Shield size={32} className="text-zinc-700" />
            <p className="text-zinc-600 font-mono text-sm">Aucune action enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">

            {/* Header colonnes */}
            <div className="flex px-5 py-2 text-xs font-mono text-zinc-600 uppercase tracking-wider gap-4">
              <span className="w-8">#</span>
              <span className="w-44">Date</span>
              <span className="w-48">Pod</span>
              <span className="w-36">Action</span>
              <span className="w-48">Changement</span>
              <span className="w-20">Par</span>
              <span className="flex-1">Statut</span>
            </div>

            {logs.map((entry) => {
              const status = statusConfig[entry.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={entry.id}
                  className="flex px-5 py-3 text-xs font-mono hover:bg-zinc-800/50 transition-all items-center gap-4"
                >
                  <span className="w-8 text-zinc-600">#{entry.id}</span>

                  <div className="w-44 flex items-center gap-1.5 text-zinc-400">
                    <Clock size={10} className="text-zinc-600 shrink-0" />
                    <span className="truncate">{formatDate(entry.timestamp)}</span>
                  </div>

                  <span className="w-48 text-zinc-200 font-bold truncate">
                    {entry.pod_name}
                  </span>

                  <span className="w-36 text-orange-400 truncate">
                    {entry.action_type}
                  </span>

                  <div className="w-48 flex items-center gap-1">
                    <span className="text-red-400 truncate">{entry.change_before}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-green-400 truncate">{entry.change_after}</span>
                  </div>

                  <div className="w-20 flex items-center gap-1 text-zinc-400">
                    <Shield size={10} className="text-zinc-600" />
                    <span>{entry.approved_by}</span>
                  </div>

                  <div className="flex-1">
                    <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded border ${status.color}`}>
                      <StatusIcon size={10} />
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}