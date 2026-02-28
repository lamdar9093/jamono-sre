import { useState, useRef, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CopilotDrawer({ open }: { open: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/chat`, { message: msg });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Analyse les pods en erreur",
    "Quel est le statut du cluster ?",
    "Propose une remédiation",
    "Rédige un message Slack pour l'incident",
    "Résume les incidents ouverts",
  ];

  return (
    <div style={{
      position: "fixed",
      top: 48,
      right: 0,
      width: 342,
      bottom: 0,
      background: "var(--s1)",
      borderLeft: "1px solid var(--b1)",
      display: "flex",
      flexDirection: "column",
      zIndex: 55,
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.25s ease",
    }}>

      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--b1)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--brand)",
          boxShadow: "0 0 8px rgba(59,130,246,0.5)",
          animation: "pulse 2s infinite",
        }} />
        <span style={{
          fontFamily: "var(--fm)", fontSize: 10, color: "var(--t1)",
          textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
        }}>
          SRE Copilot
        </span>
        <span style={{
          fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginLeft: "auto",
          background: "var(--s2)", border: "1px solid var(--b2)",
          padding: "2px 7px", borderRadius: 4,
        }}>
          IA · jamono
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>
              Pose une question sur ton cluster, tes incidents, ou demande une comm Slack.
            </p>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                style={{
                  padding: "9px 12px",
                  background: "var(--s2)",
                  border: "1px solid var(--b2)",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--fm)",
                  fontSize: 11,
                  color: "var(--t2)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-b)";
                  (e.currentTarget as HTMLElement).style.color = "var(--t1)";
                  (e.currentTarget as HTMLElement).style.background = "var(--brand-a)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--t2)";
                  (e.currentTarget as HTMLElement).style.background = "var(--s2)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            {m.role === "assistant" && (
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "var(--brand-a)", border: "1px solid rgba(59,130,246,0.2)",
                display: "grid", placeItems: "center",
                flexShrink: 0, marginRight: 8, marginTop: 2,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)" }} />
              </div>
            )}
            <div style={{
              maxWidth: "82%",
              padding: "9px 12px",
              borderRadius: m.role === "user" ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
              background: m.role === "user" ? "var(--brand-a)" : "var(--s2)",
              border: `1px solid ${m.role === "user" ? "var(--brand-b)" : "var(--b2)"}`,
              fontFamily: "var(--fm)",
              fontSize: 11.5,
              color: "var(--t1)",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: "var(--brand-a)", border: "1px solid rgba(59,130,246,0.2)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)" }} />
            </div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
              analyse en cours
              <span style={{ animation: "blink 1s infinite" }}>...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--b1)",
        display: "flex",
        gap: 8,
        flexShrink: 0,
        background: "var(--s1)",
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Pose une question..."
          style={{
            flex: 1,
            background: "var(--s2)",
            border: "1px solid var(--b2)",
            borderRadius: "var(--r)",
            padding: "8px 12px",
            fontFamily: "var(--fm)",
            fontSize: 11.5,
            color: "var(--t1)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-b)"}
          onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 34, height: 34,
            borderRadius: "var(--r)",
            background: input.trim() ? "var(--brand)" : "var(--s2)",
            border: input.trim() ? "none" : "1px solid var(--b2)",
            cursor: loading ? "not-allowed" : "pointer",
            display: "grid", placeItems: "center",
            opacity: loading ? 0.5 : 1,
            transition: "all 0.15s",
            flexShrink: 0,
            boxShadow: input.trim() ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </div>
    </div>
  );
}