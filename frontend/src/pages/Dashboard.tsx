import { useState, type ReactNode } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Zap,
} from "lucide-react";
import type { ApiResponse, Remediation } from "../types";

const API_URL = "http://localhost:8000";

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const runScan = async () => {
    setLoading(true);
    setApproved(false);
    try {
      const res = await axios.post(`${API_URL}/chat`, {
        message:
          "Analyse les pods. Donne un résumé lisible et garde les logs techniques pour plus tard.",
        thread_id: "dashboard_sess",
      });
      setResponse(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approvePatch = async (rem: Remediation) => {
    setApproving(true);
    try {
      await axios.post(`${API_URL}/chat`, {
        message: `OUI, applique le changement pour ${rem.component}`,
        thread_id: "dashboard_sess",
      });
      setApproved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  const rem = response?.remediation;

  return (
    <div className="space-y-6">

      {/* En-tête page */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Vue d'ensemble du cluster k3d-local
          </p>
        </div>

        {/* Bouton scan */}
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm rounded transition-all font-mono tracking-wide"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Zap size={15} />
          )}
          {loading ? "Analyse..." : "Lancer un scan"}
        </button>
      </div>

      {/* Cartes statut */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Statut global"
          value={
            !response
              ? "—"
              : rem?.incident_detected
              ? "Incident détecté"
              : "Nominal"
          }
          icon={
            !response ? (
              <Activity size={18} className="text-zinc-600" />
            ) : rem?.incident_detected ? (
              <AlertTriangle size={18} className="text-orange-500" />
            ) : (
              <CheckCircle size={18} className="text-green-500" />
            )
          }
          accent={
            !response ? "zinc" : rem?.incident_detected ? "orange" : "green"
          }
        />
        <StatCard
          label="Sévérité"
          value={rem ? rem.severity.toUpperCase() : "—"}
          icon={<AlertTriangle size={18} className="text-zinc-600" />}
          accent={
            rem?.severity === "high"
              ? "red"
              : rem?.severity === "medium"
              ? "orange"
              : "zinc"
          }
        />
        <StatCard
          label="Action requise"
          value={rem ? rem.action_type : "—"}
          icon={<Zap size={18} className="text-zinc-600" />}
          accent={rem?.action_type !== "NONE" ? "orange" : "zinc"}
        />
      </div>

      {/* Zone principale : diagnostic + remédiation */}
      {response && (
        <div className="grid grid-cols-3 gap-4">

          {/* Diagnostic — 2/3 */}
          <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
              <Activity size={15} className="text-orange-500" />
              <span className="text-sm font-mono text-zinc-300 tracking-wide uppercase">
                Rapport de l'agent
              </span>
            </div>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
              {response.response}
            </div>
          </div>

          {/* Remédiation — 1/3 */}
          <div className="col-span-1">
            {rem && rem.incident_detected ? (
              <div className="bg-zinc-900 border border-orange-500/30 rounded-lg p-5 space-y-4">
                
                {/* Header alerte */}
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <AlertTriangle size={15} className="text-orange-500" />
                  <span className="text-sm font-mono text-orange-400 tracking-wide uppercase">
                    Action requise
                  </span>
                </div>

                {/* Composant */}
                <div>
                  <p className="text-xs text-zinc-500 font-mono mb-1">COMPOSANT</p>
                  <p className="text-sm text-zinc-100 font-mono font-bold">
                    {rem.component}
                  </p>
                </div>

                {/* Justification */}
                <div>
                  <p className="text-xs text-zinc-500 font-mono mb-1">CAUSE</p>
                  <p className="text-sm text-zinc-300">{rem.justification}</p>
                </div>

                {/* Diff avant/après */}
                <div className="bg-zinc-950 rounded p-3 border border-zinc-800">
                  <p className="text-xs text-zinc-500 font-mono mb-2">CHANGEMENT PROPOSÉ</p>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded">
                      - {rem.suggested_change.current}
                    </span>
                    <ChevronRight size={12} className="text-zinc-600" />
                    <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">
                      + {rem.suggested_change.new}
                    </span>
                  </div>
                </div>

                {/* Bouton approbation */}
                {!approved ? (
                  <button
                    onClick={() => approvePatch(rem)}
                    disabled={approving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold text-sm rounded transition-all font-mono"
                  >
                    {approving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    {approving ? "Application..." : "Approuver et Appliquer"}
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded font-mono">
                    <CheckCircle size={14} />
                    Patch appliqué ✓
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col items-center justify-center h-full gap-3">
                <CheckCircle size={32} className="text-green-500" />
                <p className="text-sm text-zinc-400 font-mono text-center">
                  Aucun incident détecté
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* État vide */}
      {!response && !loading && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-4">
          <Activity size={40} className="text-zinc-700" />
          <p className="text-zinc-500 font-mono text-sm">
            Lance un scan pour analyser le cluster
          </p>
        </div>
      )}

    </div>
  );
}

// Composant carte statut
function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: string;
}) {
  const borderColor: Record<string, string> = {
    zinc: "border-zinc-800",
    orange: "border-orange-500/30",
    green: "border-green-500/30",
    red: "border-red-500/30",
  };

  return (
    <div
      className={`bg-zinc-900 border ${borderColor[accent]} rounded-lg p-4 flex items-center gap-4`}
    >
      <div className="p-2 bg-zinc-800 rounded">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold text-zinc-100 font-mono mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}