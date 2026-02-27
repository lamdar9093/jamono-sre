import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

interface Member {
  id: number;
  name: string;
  email: string | null;
  slack_username: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sre:      { label: "SRE",       color: "var(--g)",   bg: "var(--g-a)",   border: "rgba(36,168,118,0.2)" },
  devops:   { label: "DevOps",    color: "var(--jam2)", bg: "var(--jam-a)", border: "var(--jam-b)" },
  engineer: { label: "Engineer",  color: "var(--bl)",  bg: "var(--bl-a)",  border: "rgba(58,120,192,0.2)" },
  lead:     { label: "Tech Lead", color: "var(--am)",  bg: "var(--am-a)",  border: "rgba(200,136,10,0.2)" },
  manager:  { label: "Manager",   color: "var(--t2)",  bg: "var(--s2)",    border: "var(--b2)" },
};


export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [oncall, setOncall] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showOncall, setShowOncall] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/team`);
      setMembers(res.data.members ?? []);
      setOncall(res.data.oncall ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const deleteMember = async (id: number) => {
    await axios.delete(`${API_URL}/team/members/${id}`);
    fetch();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.02em" }}>Équipe</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            // {members.length} membre{members.length !== 1 ? "s" : ""} · rotation on-call
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 5,
          fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", border: "none",
          background: "var(--jam)", color: "#fff",
        }}>
          + Membre
        </button>
      </div>

      {/* On-call card */}
      <div style={{
        background: oncall ? "rgba(36,168,118,0.04)" : "var(--s1)",
        border: oncall ? "1px solid rgba(36,168,118,0.14)" : "1px solid var(--b1)",
        borderRadius: "var(--r)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Avatar large */}
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: oncall ? "var(--g)" : "var(--b2)",
            display: "grid", placeItems: "center",
            fontSize: 16, fontWeight: 700,
            color: oncall ? "#030a05" : "var(--t3)",
            flexShrink: 0,
            boxShadow: oncall ? "0 0 0 4px rgba(36,168,118,0.15)" : "none",
            transition: "all 0.2s",
          }}>
            {oncall ? oncall.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: oncall ? "var(--g)" : "var(--t3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>
              {oncall ? "● on-call maintenant" : "○ aucun on-call"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: oncall ? "var(--t1)" : "var(--t3)", letterSpacing: "-0.01em" }}>
              {oncall ? oncall.name : "Non assigné"}
            </div>
            {oncall?.slack_username && (
              <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                @{oncall.slack_username}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowOncall(true)}
          disabled={members.length === 0}
          style={{
            padding: "5px 12px", borderRadius: 5,
            fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
            cursor: members.length === 0 ? "not-allowed" : "pointer",
            border: "1px solid var(--b2)", background: "transparent",
            color: "var(--t2)", opacity: members.length === 0 ? 0.4 : 1,
            transition: "all 0.1s",
          }}
          onMouseEnter={e => { if (members.length > 0) { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
        >
          Changer
        </button>
      </div>

      {/* Members list */}
      <div style={{ background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderBottom: "1px solid var(--b1)" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jam)" }} />
          <span style={{ fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Membres
          </span>
          <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b2)", padding: "1px 5px", borderRadius: 3 }}>
            {members.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "32px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Chargement...</p>
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: "40px 14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--s2)", border: "1px solid var(--b2)", display: "grid", placeItems: "center" }}>
              <span style={{ color: "var(--t3)", fontSize: 16 }}>?</span>
            </div>
            <p style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>Aucun membre — ajoute ton équipe</p>
          </div>
        ) : members.map((m) => {
          const role = ROLES[m.role] || ROLES.engineer;
          const isOncall = oncall?.id === m.id;

          return (
            <div
              key={m.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderBottom: "1px solid var(--b1)",
                transition: "background 0.08s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--s2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isOncall ? "var(--g)" : "var(--s3)",
                border: isOncall ? "1px solid rgba(36,168,118,0.3)" : "1px solid var(--b2)",
                display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700,
                color: isOncall ? "#030a05" : "var(--t2)",
                flexShrink: 0,
                transition: "all 0.15s",
              }}>
                {m.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                    {m.name}
                  </span>
                  {isOncall && (
                    <span style={{
                      fontFamily: "var(--fm)", fontSize: 8, color: "var(--g)",
                      background: "var(--g-a)", border: "1px solid rgba(36,168,118,0.2)",
                      padding: "1px 5px", borderRadius: 3,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>
                      on-call
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  {m.email && (
                    <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>
                      {m.email}
                    </span>
                  )}
                  {m.slack_username && (
                    <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>
                      @{m.slack_username}
                    </span>
                  )}
                </div>
              </div>

              {/* Role */}
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "2px 7px", borderRadius: 3,
                fontFamily: "var(--fm)", fontSize: 9, fontWeight: 500, letterSpacing: "0.05em",
                color: role.color, background: role.bg, border: `1px solid ${role.border}`,
                flexShrink: 0,
              }}>
                {role.label}
              </span>

              {/* Delete */}
              <button
                onClick={() => deleteMember(m.id)}
                style={{
                  width: 26, height: 26, borderRadius: 4,
                  border: "1px solid transparent", background: "transparent",
                  color: "var(--t3)", cursor: "pointer", fontSize: 14,
                  display: "grid", placeItems: "center",
                  transition: "all 0.1s", flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,56,56,0.2)"; (e.currentTarget as HTMLElement).style.background = "var(--re-a)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: 10, width: "100%", maxWidth: 400, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Ajouter un membre</span>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <AddForm onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); fetch(); }} />
          </div>
        </div>
      )}

      {/* Oncall modal */}
      {showOncall && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: 10, width: "100%", maxWidth: 400, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Définir l'on-call</span>
              <button onClick={() => setShowOncall(false)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <OncallForm members={members} onClose={() => setShowOncall(false)} onSet={() => { setShowOncall(false); fetch(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", slack_username: "", role: "engineer" });
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
    borderRadius: "var(--r)", padding: "6px 10px",
    fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", outline: "none",
  };

  const lbl: React.CSSProperties = {
    fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)",
    textTransform: "uppercase", letterSpacing: "0.1em",
    display: "block", marginBottom: 4,
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/team/members`, {
        ...form,
        email: form.email || null,
        slack_username: form.slack_username || null,
      });
      onAdded();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div><label style={lbl}>Nom *</label><input type="text" value={form.name} placeholder="Alice Dupont" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} /></div>
      <div><label style={lbl}>Email</label><input type="email" value={form.email} placeholder="alice@company.com" onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} /></div>
      <div><label style={lbl}>Username Slack</label><input type="text" value={form.slack_username} placeholder="alice.dupont" onChange={e => setForm(p => ({ ...p, slack_username: e.target.value }))} style={inp} /></div>
      <div>
        <label style={lbl}>Rôle</label>
        <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inp}>
          <option value="sre">SRE</option>
          <option value="devops">DevOps</option>
          <option value="engineer">Engineer</option>
          <option value="lead">Tech Lead</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)" }}>Annuler</button>
        <button onClick={submit} disabled={saving || !form.name.trim()} style={{ padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "var(--jam)", color: "#fff", opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
          {saving ? "Ajout..." : "Ajouter"}
        </button>
      </div>
    </div>
  );
}

function OncallForm({ members, onClose, onSet }: { members: Member[]; onClose: () => void; onSet: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
    borderRadius: "var(--r)", padding: "6px 10px",
    fontFamily: "var(--fm)", fontSize: 11, color: "var(--t1)", outline: "none",
  };

  const lbl: React.CSSProperties = {
    fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--t3)",
    textTransform: "uppercase", letterSpacing: "0.1em",
    display: "block", marginBottom: 4,
  };

  const submit = async () => {
    if (!selectedId || !endDate) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/team/oncall`, { member_id: selectedId, start_date: startDate, end_date: endDate });
      onSet();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={lbl}>Membre *</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {members.map(m => (
            <div
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: "var(--r)", cursor: "pointer",
                border: selectedId === m.id ? "1px solid var(--jam-b)" : "1px solid var(--b2)",
                background: selectedId === m.id ? "var(--jam-a)" : "transparent",
                transition: "all 0.1s",
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: selectedId === m.id ? "var(--jam)" : "var(--s2)",
                display: "grid", placeItems: "center",
                fontSize: 10, fontWeight: 700,
                color: selectedId === m.id ? "#fff" : "var(--t2)",
              }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: selectedId === m.id ? "var(--jam2)" : "var(--t1)" }}>{m.name}</div>
                {m.slack_username && <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)" }}>@{m.slack_username}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><label style={lbl}>Début</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Fin *</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inp} /></div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)" }}>Annuler</button>
        <button onClick={submit} disabled={saving || !selectedId || !endDate} style={{ padding: "6px 14px", borderRadius: 5, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "var(--jam)", color: "#fff", opacity: saving || !selectedId || !endDate ? 0.5 : 1 }}>
          {saving ? "Sauvegarde..." : "Confirmer"}
        </button>
      </div>
    </div>
  );
}