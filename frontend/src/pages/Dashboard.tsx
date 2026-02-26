import { useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import type { ApiResponse, Remediation, Pod } from "../types";
import PodCard from "../components/PodCard";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Zap,
  X,
  FileText,
  LayoutGrid,
  List,
} from "lucide-react";

import RemediationModal from "../components/RemediationModal";

const API_URL = "http://localhost:8000";

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerContent, setDrawerContent] = useState("");
  const [drawerLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [remediationTarget, setRemediationTarget] = useState<{ pod: string; rem: Remediation } | null>(null);

useEffect(() => {
  fetchPods();
  // Refresh automatique toutes les 30 secondes
  const interval = setInterval(fetchPods, 30000);
  return () => clearInterval(interval);
}, []);

  const fetchPods = async () => {
    setPodsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/pods`);
      setPods(res.data.pods);
    } catch (e) {
      console.error(e);
    } finally {
      setPodsLoading(false);
    }
  };

  const runScan = async () => {
    setLoading(true);
    setApproved(false);
    try {
      const [scanRes] = await Promise.all([
        axios.post(`${API_URL}/chat`, {
          message: "Analyse les pods en erreur. Donne un résumé concis.",
          thread_id: "dashboard_sess",
        }),
        fetchPods(),
      ]);
      setResponse(scanRes.data);
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
      await fetchPods();
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  const requestRemediation = async (podName: string) => {
  setLoading(true);
  try {
    const res = await axios.post(`${API_URL}/chat`, {
      message: `Analyse le pod ${podName} et propose une remédiation précise.`,
      thread_id: "dashboard_sess",
    });
    setResponse(res.data);
    if (res.data.remediation?.incident_detected) {
      setRemediationTarget({ pod: podName, rem: res.data.remediation });
      setShowRemediationModal(true);
    }
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
  }
};

  const rem = response?.remediation;
  const unhealthyCount = pods.filter((p) => p.health_status === "UNHEALTHY").length;
  const healthyCount = pods.filter((p) => p.health_status === "HEALTHY").length;

  return (
    <div className="space-y-6 relative">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Vue d'ensemble du cluster k3d-local</p>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm rounded transition-all font-mono"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {loading ? "Analyse..." : "Lancer un scan"}
        </button>
      </div>

      {/* Cartes statut */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Pods total"
          value={pods.length ? `${pods.length} pods` : "—"}
          icon={<Activity size={18} className="text-zinc-400" />}
          accent="zinc"
        />
        <StatCard
          label="Sains"
          value={pods.length ? `${healthyCount} pods` : "—"}
          icon={<CheckCircle size={18} className="text-green-500" />}
          accent="green"
        />
        <StatCard
          label="En erreur"
          value={pods.length ? `${unhealthyCount} pods` : "—"}
          icon={<AlertTriangle size={18} className={unhealthyCount > 0 ? "text-orange-500" : "text-zinc-600"} />}
          accent={unhealthyCount > 0 ? "orange" : "zinc"}
        />
        <StatCard
          label="Sévérité"
          value={rem ? rem.severity.toUpperCase() : "—"}
          icon={<Zap size={18} className="text-zinc-600" />}
          accent={rem?.severity === "high" ? "red" : rem?.severity === "medium" ? "orange" : "zinc"}
        />
      </div>

      {/* Section Pods */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg">

        {/* Header section pods */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-orange-500" />
            <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
              Pods — default
            </span>
            {podsLoading && <Loader2 size={13} className="animate-spin text-zinc-600" />}
          </div>

          {/* Toggle vue */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "grid" ? "bg-zinc-600 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "list" ? "bg-zinc-600 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <List size={13} />
            </button>
          </div>
        </div>

        {/* Grille ou Liste */}
        <div className="p-4">
          {pods.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-zinc-600 font-mono text-sm">
              {podsLoading ? "Chargement..." : "Aucun pod trouvé"}
            </div>
          ) : (
            <div className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-3"
                : "flex flex-col gap-2"
            }>
              {pods.map((pod) => (
                <PodCard
                  key={pod.pod_name}
                  pod={pod}
                  onRemediationRequest={requestRemediation}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rapport agent + Remédiation */}
      {response && (
        <div className="grid grid-cols-3 gap-4">

          {/* Rapport — 2/3 */}
          <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-orange-500" />
                <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
                  Rapport de l'agent
                </span>
              </div>
              <button
                onClick={() => {
                  setDrawerTitle("Analyse complète");
                  setDrawerContent(response.response);
                  setShowDrawer(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-all text-xs font-mono"
              >
                <FileText size={13} />
                Voir l'analyse complète
              </button>
            </div>
            <div className="text-sm text-zinc-300 leading-relaxed">
              {response.response}
            </div>
          </div>

          {/* Remédiation — 1/3 */}
          <div className="col-span-1">
            {rem && rem.incident_detected ? (
              <div className="bg-zinc-900 border border-orange-500/30 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <AlertTriangle size={15} className="text-orange-500" />
                  <span className="text-sm font-mono text-orange-400 uppercase tracking-wide">
                    Action requise
                  </span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-mono mb-1">COMPOSANT</p>
                  <p className="text-sm text-zinc-100 font-mono font-bold">{rem.component}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-mono mb-1">CAUSE</p>
                  <p className="text-sm text-zinc-300">{rem.justification}</p>
                </div>
                <div className="bg-zinc-950 rounded p-3 border border-zinc-800">
                  <p className="text-xs text-zinc-500 font-mono mb-2">CHANGEMENT PROPOSÉ</p>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded">
                      - {rem.suggested_change.current || "actuel"}
                    </span>
                    <ChevronRight size={12} className="text-zinc-600" />
                    <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">
                      + {rem.suggested_change.new}
                    </span>
                  </div>
                </div>
                {!approved ? (
                  <button
                    onClick={() => approvePatch(rem)}
                    disabled={approving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold text-sm rounded transition-all font-mono"
                  >
                    {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
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
                <p className="text-sm text-zinc-400 font-mono text-center">Aucun incident détecté</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* État vide */}
      {!response && !loading && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4">
          <Activity size={36} className="text-zinc-700" />
          <p className="text-zinc-500 font-mono text-sm">Lance un scan pour analyser le cluster</p>
        </div>
      )}

      {/* Drawer */}
      {showDrawer && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowDrawer(false)} />
          <div className="fixed top-0 right-0 h-full w-2/5 bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-orange-500" />
                <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
                  {drawerTitle}
                </span>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {drawerLoading ? (
                <div className="flex items-center justify-center h-full gap-2 text-zinc-600">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm font-mono">Chargement...</span>
                </div>
              ) : (
                <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {drawerContent}
                </pre>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de remédiation */}
      {showRemediationModal && remediationTarget && (
        <RemediationModal
          remediation={remediationTarget.rem}
          podName={remediationTarget.pod}
          onClose={() => setShowRemediationModal(false)}
          onSuccess={() => fetchPods()}
        />
      )}

    </div>
  );
}

function StatCard({
  label, value, icon, accent,
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
    <div className={`bg-zinc-900 border ${borderColor[accent]} rounded-lg p-4 flex items-center gap-4`}>
      <div className="p-2 bg-zinc-800 rounded">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-zinc-100 font-mono mt-0.5">{value}</p>
      </div>
    </div>
  );
}