// Carte individuelle d'un pod — affiche statut, diagnostic, events, logs et actions de remédiation
import { useState } from "react";
import axios from "axios";
import type { Pod } from "../types";
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap,
  Loader2,
  Clock,
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface PodCardProps {
  pod: Pod;
  onRemediationRequest: (podName: string) => void;
}

export default function PodCard({ pod, onRemediationRequest }: PodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "logs">("events");
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const isHealthy = pod.health_status === "HEALTHY";

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && events.length === 0) {
      fetchEvents();
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await axios.get(`${API_URL}/pods/${pod.pod_name}/events`);
      setEvents(res.data.events);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchLogs = async () => {
    if (logs) return;
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_URL}/pods/${pod.pod_name}/logs`);
      setLogs(res.data.logs);
    } catch (e) {
      setLogs("Impossible de récupérer les logs.");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleTabChange = (tab: "events" | "logs") => {
    setActiveTab(tab);
    if (tab === "logs") fetchLogs();
  };

  return (
    <div className={`bg-zinc-900 border rounded-lg overflow-hidden transition-all ${
      isHealthy ? "border-zinc-800" : "border-orange-500/40"
    }`}>

      {/* Header carte */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {isHealthy ? (
            <CheckCircle size={16} className="text-green-500 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-orange-500 shrink-0 animate-pulse" />
          )}
          <span className="text-sm font-mono font-bold text-zinc-100 truncate">
            {pod.pod_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pod.restarts > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              <RefreshCw size={10} />
              {pod.restarts} restarts
            </span>
          )}
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
            isHealthy
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-orange-500/10 text-orange-400 border-orange-500/20"
          }`}>
            {pod.internal_phase}
          </span>
          <button
            onClick={handleExpand}
            className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Contenu expandable */}
      {expanded && (
        <div className="border-t border-zinc-800">

          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => handleTabChange("events")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono transition-all ${
                activeTab === "events"
                  ? "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Clock size={11} />
              Events
            </button>
            <button
              onClick={() => handleTabChange("logs")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono transition-all ${
                activeTab === "logs"
                  ? "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Terminal size={11} />
              Logs
            </button>
          </div>

          {/* Contenu tab */}
          <div className="p-4">

            {/* Tab Events */}
            {activeTab === "events" && (
              <div className="space-y-2">
                {loadingEvents ? (
                  <div className="flex items-center gap-2 text-zinc-600 text-xs font-mono">
                    <Loader2 size={12} className="animate-spin" />
                    Chargement des events...
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-xs text-zinc-600 font-mono">Aucun event trouvé.</p>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2.5 rounded border text-xs font-mono ${
                      e.type === "Warning"
                        ? "bg-orange-500/5 border-orange-500/20 text-orange-300"
                        : "bg-zinc-800/50 border-zinc-700 text-zinc-400"
                    }`}>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${e.type === "Warning" ? "text-orange-400" : "text-zinc-300"}`}>
                            {e.reason}
                          </span>
                          <span className="text-zinc-600">×{e.count}</span>
                        </div>
                        <span className="text-zinc-500 break-words">{e.message}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab Logs */}
            {activeTab === "logs" && (
              <div>
                {loadingLogs ? (
                  <div className="flex items-center gap-2 text-zinc-600 text-xs font-mono">
                    <Loader2 size={12} className="animate-spin" />
                    Chargement des logs...
                  </div>
                ) : (
                  <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words bg-zinc-950 rounded p-3 border border-zinc-800">
                    {logs || "Aucun log disponible."}
                  </pre>
                )}
              </div>
            )}

            {/* Bouton remédiation — seulement si pod en erreur */}
            {!isHealthy && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => onRemediationRequest(pod.pod_name)}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:text-orange-300 rounded text-xs font-mono font-bold transition-all"
                >
                  <Zap size={12} />
                  Demander une remédiation IA
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}