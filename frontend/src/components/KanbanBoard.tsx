import { useState } from "react";
import axios from "axios";
import API_URL from "../config";

interface Incident {
  id: number; title: string; description: string | null; severity: string; status: string;
  source: string; environment: string; linked_pod: string | null; assigned_to: string | null;
  created_by: string; slack_channel: string | null; created_at: string; updated_at: string;
  resolved_at: string | null; mttr_seconds: number | null;
}

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: "var(--sev-critical)", label: "Critical" },
  high: { color: "var(--sev-high)", label: "High" },
  medium: { color: "var(--sev-medium)", label: "Medium" },
  low: { color: "var(--sev-low)", label: "Low" },
};

const COLUMNS = [
  { key: "open", label: "Ouvert", color: "var(--re)", icon: "○" },
  { key: "in_progress", label: "Investigation", color: "var(--am)", icon: "◔" },
  { key: "watching", label: "Surveillance", color: "var(--bl)", icon: "◑" },
  { key: "resolved", label: "Résolu", color: "var(--g)", icon: "●" },
];

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

export default function KanbanBoard({ incidents, onStatusChange, onSelect }: {
  incidents: Incident[];
  onStatusChange: (id: number, status: string) => void;
  onSelect: (inc: Incident) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    // Rendre l'élément semi-transparent pendant le drag
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.4";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDragId(null);
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(colKey);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOver(null);
    if (dragId !== null) {
      const inc = incidents.find(i => i.id === dragId);
      if (inc && inc.status !== colKey) {
        onStatusChange(dragId, colKey);
      }
    }
    setDragId(null);
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`,
      gap: 12,
      alignItems: "start",
      minHeight: 400,
    }}>
      {COLUMNS.map(col => {
        const colIncidents = incidents.filter(i => i.status === col.key);
        const isOver = dragOver === col.key;

        return (
          <div
            key={col.key}
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 300,
              borderRadius: 12,
              padding: 8,
              background: isOver ? `${col.color}04` : "transparent",
              border: isOver ? `2px dashed ${col.color}30` : "2px dashed transparent",
              transition: "all 0.15s",
            }}
          >
            {/* Column header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
            }}>
              <span style={{ fontSize: 14, color: col.color }}>{col.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{col.label}</span>
              <span style={{
                fontSize: 11, color: "var(--t3)",
                background: "var(--s2)", padding: "1px 8px", borderRadius: 10,
                fontWeight: 500, minWidth: 20, textAlign: "center",
              }}>{colIncidents.length}</span>
            </div>

            {/* Cards */}
            {colIncidents.length === 0 ? (
              <div style={{
                padding: "24px 12px", textAlign: "center",
                borderRadius: 8, border: "1px dashed var(--b2)",
              }}>
                <p style={{ fontSize: 12, color: "var(--t3)" }}>
                  {col.key === "resolved" ? "Aucun incident résolu" : "Aucun incident"}
                </p>
              </div>
            ) : (
              colIncidents.map(inc => {
                const sev = SEV[inc.severity] || SEV.low;
                return (
                  <div
                    key={inc.id}
                    draggable
                    onDragStart={e => handleDragStart(e, inc.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelect(inc)}
                    style={{
                      padding: "14px 14px",
                      borderRadius: 10,
                      background: "var(--s1)",
                      border: "1px solid var(--b1)",
                      cursor: "grab",
                      transition: "all 0.12s",
                      boxShadow: dragId === inc.id ? "0 4px 16px rgba(0,0,0,0.08)" : "none",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                  >
                    {/* Top row: ID + time */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500 }}>INC-{inc.id}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round">
                          <circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2 1.5"/>
                        </svg>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>{timeAgo(inc.created_at)}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "var(--t1)",
                      lineHeight: 1.4, marginBottom: 10,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {inc.title}
                    </div>

                    {/* Bottom row: severity + assignee + slack */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "2px 7px", borderRadius: 5,
                        fontSize: 10, fontWeight: 500, color: sev.color, background: `${sev.color}10`,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
                        {sev.label}
                      </span>

                      {inc.environment === "prod" && (
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 500, color: "var(--sev-high)", background: "var(--sev-high-a)" }}>prod</span>
                      )}

                      {inc.slack_channel && (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="#E01E5A" style={{ opacity: 0.6 }}>
                          <path d="M9.5 1.5a1.5 1.5 0 00-1.5 1.5v4h1.5A1.5 1.5 0 009.5 1.5z" opacity="0.8"/>
                        </svg>
                      )}

                      <div style={{ marginLeft: "auto" }}>
                        {inc.assigned_to ? (
                          <div style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: "var(--s3)", display: "grid", placeItems: "center",
                            fontSize: 10, fontWeight: 600, color: "var(--t2)",
                          }}>
                            {inc.assigned_to.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round" style={{ opacity: 0.4 }}>
                            <circle cx="8" cy="5.5" r="2.5"/><path d="M3 14a5 5 0 0110 0"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}