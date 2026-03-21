import { useState, useRef, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  { text: "Analyse les pods en erreur", icon: "🔍" },
  { text: "Quel est le statut du cluster ?", icon: "☸" },
  { text: "Propose une remédiation", icon: "🔧" },
  { text: "Rédige un message Slack", icon: "💬" },
  { text: "Résume les incidents ouverts", icon: "📋" },
];

export default function CopilotDrawer({ open }: { open: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion au copilot." }]);
    } finally { setLoading(false); }
  };

  const useSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>("#copilot-input");
      if (el) el.focus();
    }, 50);
  };

  return (
    <div style={{
      position: "fixed", top: 48, right: 0, width: 360, bottom: 0,
      background: "var(--s1)", borderLeft: "1px solid var(--b1)",
      display: "flex", flexDirection: "column", zIndex: 55,
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.25s ease",
      boxShadow: open ? "-8px 0 30px rgba(0,0,0,0.06)" : "none",
    }}>

      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--b1)",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        {/* Mini dot grid logo */}
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: "var(--t1)", display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, padding: 3.5, flexShrink: 0,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C" }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Copilot</div>
        </div>
        <span style={{
          fontSize: 11, color: "var(--t3)", background: "var(--s2)",
          padding: "3px 8px", borderRadius: 6,
        }}>IA</span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "18px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              {/* Large dot grid */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px",
                background: "var(--s2)", display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)", gap: 3, padding: 7,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C15F3C" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22A06B" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22A06B" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Comment puis-je aider ?</p>
              <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
                Analyse de cluster, diagnostic, remédiation, rédaction de messages...
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => useSuggestion(s.text)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--s1)", border: "1px solid var(--b1)",
                  fontSize: 13, color: "var(--t2)", cursor: "pointer",
                  textAlign: "left", transition: "all 0.12s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"; }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>{s.icon}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", gap: 8,
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            {m.role === "assistant" && (
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
                background: "var(--t1)", display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: 3,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C" }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
              </div>
            )}
            <div style={{
              maxWidth: "80%", padding: "10px 14px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: m.role === "user" ? "var(--t1)" : "var(--s2)",
              color: m.role === "user" ? "#fff" : "var(--t1)",
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: "var(--t1)", display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: 3,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C" }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.5 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C15F3C", opacity: 0.25 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B", opacity: 0.5 }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#22A06B" }} />
            </div>
            <div style={{ display: "flex", gap: 4, padding: "10px 14px", borderRadius: 12, background: "var(--s2)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--t3)", animation: "pulse 1.2s infinite 0s" }} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--t3)", animation: "pulse 1.2s infinite 0.2s" }} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--t3)", animation: "pulse 1.2s infinite 0.4s" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 14px", borderTop: "1px solid var(--b1)",
        display: "flex", gap: 8, flexShrink: 0, background: "var(--s1)",
      }}>
        <input
          id="copilot-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Poser une question..."
          style={{
            flex: 1, background: "var(--s2)", border: "1px solid var(--b2)",
            borderRadius: 8, padding: "10px 14px", fontSize: 13,
            color: "var(--t1)", outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--t1)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--b2)"; }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
          background: input.trim() ? "var(--t1)" : "var(--s2)",
          border: input.trim() ? "none" : "1px solid var(--b2)",
          cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
          display: "grid", placeItems: "center",
          opacity: loading ? 0.5 : 1, transition: "all 0.15s",
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={input.trim() ? "#fff" : "var(--t3)"} strokeWidth="2" strokeLinecap="round">
            <path d="M2 8h12M10 4l4 4-4 4"/>
          </svg>
        </button>
      </div>
    </div>
  );
}