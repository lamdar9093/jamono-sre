// Modal de confirmation de remédiation — affiche le plan complet avant exécution et permet le rollback
import { useState } from "react";
import axios from "axios";
import type { Remediation } from "../types";
import {
  AlertTriangle,
  CheckCircle,
  X,
  Zap,
  Loader2,
  ChevronRight,
  RotateCcw,
  Shield,
} from "lucide-react";
import API_URL from "../config";

interface RemediationModalProps {
  remediation: Remediation;
  podName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "confirm" | "executing" | "success" | "failed";

export default function RemediationModal({
  remediation,
  podName,
  onClose,
  onSuccess,
}: RemediationModalProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [actionId, setActionId] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackDone, setRollbackDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleConfirm = async () => {
    setStep("executing");
    try {
      const res = await axios.post(`${API_URL}/remediation/confirm`, {
        pod_name: podName,
        deployment_name: remediation.component,
        action_type: remediation.action_type,
        change_before: remediation.suggested_change.current,
        change_after: remediation.suggested_change.new,
        thread_id: "dashboard_sess",
      });
      setActionId(res.data.action_id);
      setStep("success");
      onSuccess();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "Erreur inconnue");
      setStep("failed");
    }
  };

  const handleRollback = async () => {
    if (!actionId) return;
    setRollingBack(true);
    try {
      await axios.post(`${API_URL}/remediation/${actionId}/rollback`);
      setRollbackDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">

        {/* Modal */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-orange-500" />
              <span className="text-sm font-mono text-zinc-200 font-bold uppercase tracking-wide">
                Validation de remédiation
              </span>
            </div>
            {step !== "executing" && (
              <button
                onClick={onClose}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Contenu selon l'étape */}
          <div className="p-6 space-y-5">

            {/* ÉTAPE 1 : Confirmation */}
            {step === "confirm" && (
              <>
                {/* Avertissement */}
                <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-400 font-mono">
                      Action irréversible sans rollback
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Cette opération va modifier un déploiement en production. Kubernetes va redémarrer le pod (~30s de downtime).
                    </p>
                  </div>
                </div>

                {/* Détails du plan */}
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    Plan d'exécution
                  </p>

                  <div className="bg-zinc-950 rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                    <Row label="Composant" value={remediation.component} />
                    <Row label="Type d'action" value={remediation.action_type} accent />
                    <Row label="Cause" value={remediation.justification} />
                    <Row label="Sévérité" value={remediation.severity.toUpperCase()} />
                  </div>

                  {/* Diff */}
                  <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-4">
                    <p className="text-xs text-zinc-500 font-mono mb-3">CHANGEMENT</p>
                    <div className="flex items-center gap-3 font-mono text-sm">
                      <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded p-2.5 text-center">
                        <p className="text-xs text-zinc-500 mb-1">AVANT</p>
                        <p className="text-red-400 font-bold">
                          {remediation.suggested_change.current || "non spécifié"}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                      <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded p-2.5 text-center">
                        <p className="text-xs text-zinc-500 mb-1">APRÈS</p>
                        <p className="text-green-400 font-bold">
                          {remediation.suggested_change.new}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 text-sm font-mono transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm font-mono transition-all"
                  >
                    <Zap size={14} />
                    Confirmer et appliquer
                  </button>
                </div>
              </>
            )}

            {/* ÉTAPE 2 : Exécution */}
            {step === "executing" && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <Loader2 size={32} className="animate-spin text-orange-500" />
                <div className="text-center">
                  <p className="text-sm font-bold text-zinc-100 font-mono">
                    Application du patch en cours...
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Kubernetes redémarre {remediation.component}
                  </p>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Succès */}
            {step === "success" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4 gap-3">
                  <CheckCircle size={36} className="text-green-500" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-zinc-100 font-mono">
                      Patch appliqué avec succès
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Action enregistrée — ID #{actionId}
                    </p>
                  </div>
                </div>

                {/* Rollback */}
                {!rollbackDone ? (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 font-mono mb-3">
                      ROLLBACK DISPONIBLE (30 min)
                    </p>
                    <button
                      onClick={handleRollback}
                      disabled={rollingBack}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 text-xs font-mono transition-all"
                    >
                      {rollingBack ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      {rollingBack ? "Rollback en cours..." : "Annuler le patch (rollback)"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 rounded text-zinc-400 text-xs font-mono">
                    <RotateCcw size={12} />
                    Rollback effectué
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-mono transition-all"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* ÉTAPE 4 : Échec */}
            {step === "failed" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4 gap-3">
                  <AlertTriangle size={36} className="text-red-500" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-zinc-100 font-mono">
                      Échec de l'application
                    </p>
                    <p className="text-xs text-red-400 mt-1 font-mono">{errorMsg}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-mono transition-all"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Composant ligne de détail
function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-zinc-500 font-mono">{label}</span>
      <span className={`text-xs font-mono font-bold ${accent ? "text-orange-400" : "text-zinc-300"}`}>
        {value}
      </span>
    </div>
  );
}