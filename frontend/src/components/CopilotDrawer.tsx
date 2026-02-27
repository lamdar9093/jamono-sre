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

  return (
    <div style={{
      position: "fixed",
      top: 44, // topbar height
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
        padding: "10px 14px",
        borderBottom: "1px solid var(--b1)",
        display: "flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
      }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bl)" }} />
        <span style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          SRE Copilot
        </span>
        <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", marginLeft: "auto" }}>
          IA · jamono
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginBottom: 8 }}>
              Pose une question sur ton cluster ou tes incidents.
            </p>
            {[
              "Analyse les pods en erreur",
              "Quel est le statut du cluster ?",
              "Propose une remédiation",
            ].map(s => (
              <div
                key={s}
                onClick={() => setInput(s)}
                style={{
                  padding: "7px 10px",
                  background: "var(--s2)",
                  border: "1px solid var(--b2)",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--fm)",
                  fontSize: 10,
                  color: "var(--t2)",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
              >
                {s}
              </div>
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
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--bl-a)", border: "1px solid rgba(58,120,192,0.2)",
                display: "grid", placeItems: "center",
                flexShrink: 0, marginRight: 6, marginTop: 2,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bl)" }} />
              </div>
            )}
            <div style={{
              maxWidth: "80%",
              padding: "7px 10px",
              borderRadius: m.role === "user" ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
              background: m.role === "user" ? "var(--jam-a)" : "var(--s2)",
              border: `1px solid ${m.role === "user" ? "var(--jam-b)" : "var(--b2)"}`,
              fontFamily: "var(--fm)",
              fontSize: 11,
              color: "var(--t1)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: "var(--bl-a)", border: "1px solid rgba(58,120,192,0.2)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bl)" }} />
            </div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>
              analyse en cours
              <span style={{ animation: "blink 1s infinite" }}>...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "8px 10px",
        borderTop: "1px solid var(--b1)",
        display: "flex",
        gap: 6,
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
            borderRadius: 5,
            padding: "6px 10px",
            fontFamily: "var(--fm)",
            fontSize: 11,
            color: "var(--t1)",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 30, height: 30,
            borderRadius: 5,
            background: input.trim() ? "var(--jam)" : "var(--s2)",
            border: "none", cursor: "pointer",
            display: "grid", placeItems: "center",
            opacity: loading ? 0.5 : 1,
            transition: "all 0.1s",
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 7h10M8 3l4 4-4 4"/>
          </svg>
        </button>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}