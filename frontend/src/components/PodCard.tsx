import { useState } from "react";
import axios from "axios";
import API_URL from "../config";

interface Pod {
  pod_name: string;
  health_status: "HEALTHY" | "UNHEALTHY";
  restarts: number;
  diagnostic: string;
  internal_phase: string;
}

export default function PodCard({ pod, onRemediate }: { pod: Pod; onRemediate?: (pod: Pod) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"events" | "logs">("events");
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const h = pod.health_status === "HEALTHY";

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await axios.get(`${API_URL}/pods/${pod.pod_name}/events`);
      setEvents(res.data.events || []);
    } catch (e) { console.error(e); }
    finally { setLoadingEvents(false); }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_URL}/pods/${pod.pod_name}/logs`);
      setLogs(res.data.logs || "");
    } catch (e) { console.error(e); }
    finally { setLoadingLogs(false); }
  };

  const toggle = () => {
    if (!expanded) {
      fetchEvents();
      fetchLogs();
    }
    setExpanded(!expanded);
  };

  return (
    <div style={{
      background: "var(--s1)",
      border: h ? "1px solid var(--b1)" : "1px solid rgba(248,113,113,0.25)",
      borderRadius: "var(--r)",
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Top accent */}
      <div style={{
        height: 2,
        background: h ? "var(--g)" : "var(--re)",
        opacity: h ? 0.4 : 0.7,
      }} />

      {/* Header row */}
      <div
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      >
        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: h ? "var(--g)" : "var(--re)",
          boxShadow: h ? "none" : "0 0 6px var(--re)60",
          animation: h ? "none" : "pulse 2s infinite",
          flexShrink: 0,
        }} />

        {/* Name + phase */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600, color: "var(--t1)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {pod.pod_name}
          </div>
          <div style={{
            fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2,
          }}>
            {pod.internal_phase}
          </div>
        </div>

        {/* Health badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 5,
          fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.04em", textTransform: "uppercase",
          color: h ? "var(--g)" : "var(--re)",
          background: h ? "var(--g-a)" : "var(--re-a)",
        }}>
          {h ? "healthy" : "unhealthy"}
        </span>

        {/* Restarts */}
        {pod.restarts > 0 && (
          <span style={{
            fontFamily: "var(--fm)", fontSize: 9, color: "var(--re)",
            background: "var(--re-a)", padding: "2px 6px", borderRadius: 4,
            border: "1px solid rgba(248,113,113,0.2)", fontWeight: 600,
          }}>
            {pod.restarts}× restart
          </span>
        )}

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 16 16"
          fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"
          style={{ transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
        >
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--b1)" }}>
          {/* Diagnostic */}
          {pod.diagnostic && (
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--b1)" }}>
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>
                Diagnostic
              </div>
              <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}>
                {pod.diagnostic}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--b1)" }}>
            {(["events", "logs"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "8px", border: "none", cursor: "pointer",
                fontFamily: "var(--fm)", fontSize: 11, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "var(--brand2)" : "var(--t3)",
                background: tab === t ? "var(--brand-a)" : "transparent",
                borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
                transition: "all 0.12s",
                textTransform: "capitalize",
              }}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: "12px 16px", maxHeight: 240, overflowY: "auto" }}>
            {tab === "events" ? (
              loadingEvents ? (
                <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
              ) : events.length === 0 ? (
                <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun événement</p>
              ) : (
                events.map((ev, i) => (
                  <div key={i} style={{
                    padding: "8px 0",
                    borderBottom: i < events.length - 1 ? "1px solid var(--b1)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontFamily: "var(--fm)", fontSize: 10, fontWeight: 600,
                        color: ev.type === "Warning" ? "var(--am)" : "var(--t2)",
                      }}>
                        {ev.type || "Event"}
                      </span>
                      <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>
                        {ev.reason}
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)", marginTop: 3, lineHeight: 1.5 }}>
                      {ev.message}
                    </p>
                  </div>
                ))
              )
            ) : (
              loadingLogs ? (
                <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
              ) : !logs ? (
                <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun log</p>
              ) : (
                <pre style={{
                  fontFamily: "var(--fm)", fontSize: 10, color: "var(--t2)",
                  lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
                  margin: 0,
                }}>
                  {logs}
                </pre>
              )
            )}
          </div>

          {/* Remediate button for unhealthy pods */}
          {!h && onRemediate && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--b1)" }}>
              <button
                onClick={() => onRemediate(pod)}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: "var(--re)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(248,113,113,0.25)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(248,113,113,0.35)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(248,113,113,0.25)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M8 2L14 13H2L8 2z"/><path d="M8 7v2.5M8 11.5v.5"/>
                </svg>
                Analyser et remédier
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}