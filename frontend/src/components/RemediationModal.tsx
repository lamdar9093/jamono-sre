import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface RemediationAction {
  id?: number;
  action_type: string;
  suggested_change: string;
  justification: string;
  requires_approval: boolean;
  change_before?: string;
  change_after?: string;
}

interface Props {
  pod_name: string;
  analysis: string;
  actions: RemediationAction[];
  onClose: () => void;
  onComplete?: () => void;
}

type Step = "review" | "executing" | "success" | "failed";

export default function RemediationModal({ pod_name, analysis, actions, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("review");
  const [selectedAction, setSelectedAction] = useState<RemediationAction | null>(actions[0] || null);
  const [result, setResult] = useState<any>(null);
  const [rollbackAvailable, setRollbackAvailable] = useState(false);
  const [rollbackTimer, setRollbackTimer] = useState(0);

  useEffect(() => {
    if (step === "success" && result?.remediation_id) {
      setRollbackAvailable(true);
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const remaining = 1800 - elapsed; // 30 min
        if (remaining <= 0) {
          setRollbackAvailable(false);
          clearInterval(interval);
        }
        setRollbackTimer(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, result]);

  const confirm = async () => {
    if (!selectedAction) return;
    setStep("executing");
    try {
      const res = await axios.post(`${API_URL}/remediation/confirm`, {
        pod_name,
        action: selectedAction,
      });
      setResult(res.data);
      setStep(res.data.status === "success" ? "success" : "failed");
    } catch (e) {
      console.error(e);
      setStep("failed");
    }
  };

  const rollback = async () => {
    if (!result?.remediation_id) return;
    setStep("executing");
    try {
      await axios.post(`${API_URL}/remediation/${result.remediation_id}/rollback`);
      setStep("review");
      setResult(null);
    } catch (e) {
      console.error(e);
      setStep("failed");
    }
  };

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
      animation: "fadeIn 0.15s ease",
    }}>
      <div style={{
        background: "var(--s1)",
        border: "1px solid var(--b2)",
        borderRadius: 14,
        width: "100%", maxWidth: 560,
        maxHeight: "85vh",
        overflow: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        animation: "scaleIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid var(--b1)",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>
              Remédiation
            </div>
            <div style={{
              fontFamily: "var(--fm)", fontSize: 11, color: "var(--re)", marginTop: 3,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--re)", animation: "pulse 2s infinite" }} />
              {pod_name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
            width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.1s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Steps indicator */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 6 }}>
          {(["review", "executing", "success"] as const).map((s, i) => {
            const active = s === step || (step === "failed" && s === "success");
            const done = (step === "executing" && s === "review") || (step === "success" && s !== "success") || (step === "failed" && s === "review");
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--fm)", fontSize: 10, fontWeight: 700,
                  background: done ? "var(--g)" : active ? "var(--brand)" : "var(--s2)",
                  color: done || active ? "#fff" : "var(--t3)",
                  border: done || active ? "none" : "1px solid var(--b2)",
                  transition: "all 0.2s",
                }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{
                  fontFamily: "var(--fm)", fontSize: 10,
                  color: active ? "var(--t1)" : "var(--t3)",
                  fontWeight: active ? 600 : 400,
                }}>
                  {s === "review" ? "Analyse" : s === "executing" ? "Exécution" : "Résultat"}
                </span>
                {i < 2 && <div style={{ width: 20, height: 1, background: "var(--b2)" }} />}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: "16px 18px" }}>

          {/* STEP: Review */}
          {step === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Analysis */}
              <div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>
                  Analyse IA
                </div>
                <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {analysis}
                </p>
              </div>

              {/* Actions */}
              {actions.length > 0 && (
                <div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>
                    Actions proposées
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {actions.map((a, i) => {
                      const isSelected = selectedAction === a;
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedAction(a)}
                          style={{
                            padding: "12px 14px", borderRadius: "var(--r)", cursor: "pointer",
                            border: isSelected ? "1px solid var(--brand-b)" : "1px solid var(--b2)",
                            background: isSelected ? "var(--brand-a)" : "var(--s2)",
                            transition: "all 0.12s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              fontFamily: "var(--fm)", fontSize: 10.5, fontWeight: 600,
                              color: isSelected ? "var(--brand2)" : "var(--t1)",
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>
                              {a.action_type}
                            </span>
                            {a.requires_approval && (
                              <span style={{
                                fontFamily: "var(--fm)", fontSize: 9, color: "var(--am)",
                                background: "var(--am-a)", padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                              }}>
                                approbation requise
                              </span>
                            )}
                          </div>
                          <p style={{ fontFamily: "var(--fm)", fontSize: 10.5, color: "var(--t2)", marginTop: 5, lineHeight: 1.5 }}>
                            {a.justification}
                          </p>

                          {/* Diff */}
                          {(a.change_before || a.change_after) && (
                            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                              {a.change_before && (
                                <div style={{
                                  padding: "6px 10px", borderRadius: 5,
                                  background: "var(--re-a)", border: "1px solid rgba(248,113,113,0.15)",
                                  fontFamily: "var(--fm)", fontSize: 10, color: "var(--re)",
                                }}>
                                  - {a.change_before}
                                </div>
                              )}
                              {a.change_after && (
                                <div style={{
                                  padding: "6px 10px", borderRadius: 5,
                                  background: "var(--g-a)", border: "1px solid rgba(52,211,153,0.15)",
                                  fontFamily: "var(--fm)", fontSize: 10, color: "var(--g)",
                                }}>
                                  + {a.change_after}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={confirm}
                disabled={!selectedAction}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
                  cursor: selectedAction ? "pointer" : "not-allowed",
                  border: "none",
                  background: "var(--brand)",
                  color: "#fff",
                  opacity: selectedAction ? 1 : 0.5,
                  boxShadow: "0 2px 10px rgba(59,130,246,0.3)",
                  transition: "all 0.15s",
                }}
              >
                Appliquer la remédiation
              </button>
            </div>
          )}

          {/* STEP: Executing */}
          {step === "executing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "32px 0" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid var(--b2)", borderTopColor: "var(--brand)",
                animation: "spin 1s linear infinite",
              }} />
              <div style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--t2)", fontWeight: 500 }}>
                Exécution en cours...
              </div>
              <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textAlign: "center" }}>
                Application de la remédiation sur {pod_name}
              </p>
            </div>
          )}

          {/* STEP: Success */}
          {step === "success" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "var(--g-a)", border: "2px solid rgba(52,211,153,0.3)",
                  display: "grid", placeItems: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="var(--g)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="13 4 6 11 3 8"/>
                  </svg>
                </div>
                <span style={{ fontFamily: "var(--fm)", fontSize: 13, fontWeight: 600, color: "var(--g)" }}>
                  Remédiation appliquée
                </span>
              </div>

              {/* Rollback */}
              {rollbackAvailable && (
                <div style={{
                  padding: "12px 14px", borderRadius: "var(--r)",
                  background: "var(--am-a)", border: "1px solid rgba(251,191,36,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--am)", fontWeight: 600 }}>
                      Rollback disponible
                    </div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                      Expire dans {fmtTimer(rollbackTimer)}
                    </div>
                  </div>
                  <button onClick={rollback} style={{
                    padding: "6px 14px", borderRadius: "var(--r)",
                    fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1px solid rgba(251,191,36,0.3)",
                    background: "transparent", color: "var(--am)",
                    transition: "all 0.12s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    Rollback
                  </button>
                </div>
              )}

              <button onClick={() => { onComplete?.(); onClose(); }} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "10px",
                borderRadius: "var(--r)",
                fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: "var(--brand)", color: "#fff",
                transition: "all 0.15s",
              }}>
                Fermer
              </button>
            </div>
          )}

          {/* STEP: Failed */}
          {step === "failed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "var(--re-a)", border: "2px solid rgba(248,113,113,0.3)",
                  display: "grid", placeItems: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--re)" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
                  </svg>
                </div>
                <span style={{ fontFamily: "var(--fm)", fontSize: 13, fontWeight: 600, color: "var(--re)" }}>
                  Échec de la remédiation
                </span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep("review")} style={{
                  flex: 1, padding: "10px", borderRadius: "var(--r)",
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", border: "1px solid var(--b2)",
                  background: "transparent", color: "var(--t2)",
                }}>
                  Réessayer
                </button>
                <button onClick={onClose} style={{
                  flex: 1, padding: "10px", borderRadius: "var(--r)",
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: "var(--s2)", color: "var(--t1)",
                }}>
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}