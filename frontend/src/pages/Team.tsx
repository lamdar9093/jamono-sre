import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";
import Modal, { formInput, FormField, FormActions } from "../components/Modal";

interface Member { id: number; name: string; email: string | null; slack_username: string | null; role: string; is_active: boolean; created_at: string; }

const ROLES: Record<string, { label: string; color: string }> = {
  sre: { label: "SRE", color: "var(--g)" }, devops: { label: "DevOps", color: "var(--brand)" },
  engineer: { label: "Engineer", color: "var(--bl)" }, lead: { label: "Tech Lead", color: "var(--am)" },
  manager: { label: "Manager", color: "var(--t2)" },
};

export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [oncall, setOncall] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showOncall, setShowOncall] = useState(false);

  const fetchData = async () => { setLoading(true); try { const res = await axios.get(`${API_URL}/team`); setMembers(res.data.members ?? []); setOncall(res.data.oncall ?? null); } catch (e) { console.error(e); } finally { setLoading(false); } };
  useEffect(() => { fetchData(); }, []);
  const deleteMember = async (id: number) => { await axios.delete(`${API_URL}/team/members/${id}`); fetchData(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Équipe</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{members.length} membre{members.length !== 1 ? "s" : ""} · rotation on-call</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "var(--t1)", color: "#fff" }}>+ Membre</button>
      </div>

      {/* On-call */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderRadius: 12, background: oncall ? "rgba(34,160,107,0.03)" : "var(--s2)", border: `1px solid ${oncall ? "rgba(34,160,107,0.10)" : "var(--b1)"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: oncall ? "rgba(34,160,107,0.08)" : "var(--s3)", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700, color: oncall ? "var(--g)" : "var(--t3)", flexShrink: 0 }}>
            {oncall ? oncall.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: oncall ? "var(--g)" : "var(--t3)", display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              {oncall && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)" }} />}
              {oncall ? "On-call maintenant" : "Aucun on-call"}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: oncall ? "var(--t1)" : "var(--t3)" }}>{oncall ? oncall.name : "Non assigné"}</div>
            {oncall?.slack_username && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>@{oncall.slack_username}</div>}
          </div>
        </div>
        <button onClick={() => setShowOncall(true)} disabled={members.length === 0} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: members.length === 0 ? "not-allowed" : "pointer", border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", opacity: members.length === 0 ? 0.4 : 1, transition: "all 0.12s" }}
          onMouseEnter={e => { if (members.length > 0) { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}>Changer</button>
      </div>

      {/* Members */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Membres</h3>
          <span style={{ fontSize: 12, color: "var(--t3)", background: "var(--s2)", padding: "2px 8px", borderRadius: 6 }}>{members.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--b1)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", background: "var(--s1)" }}><p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement...</p></div>
          : members.length === 0 ? <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--s1)" }}><p style={{ fontSize: 13, color: "var(--t3)" }}>Aucun membre — ajoute ton équipe</p></div>
          : members.map(m => {
            const role = ROLES[m.role] || ROLES.engineer;
            const isOc = oncall?.id === m.id;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "var(--s1)", transition: "background 0.1s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--s1)"; }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isOc ? "rgba(34,160,107,0.08)" : "var(--s3)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: isOc ? "var(--g)" : "var(--t2)", flexShrink: 0 }}>{m.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)" }}>{m.name}</span>
                    {isOc && <span style={{ fontSize: 10, color: "var(--g)", background: "var(--g-a)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>on-call</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 12, color: "var(--t3)" }}>
                    {m.email && <span>{m.email}</span>}
                    {m.slack_username && <span>@{m.slack_username}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: role.color, background: `${role.color}08`, padding: "3px 10px", borderRadius: 6 }}>{role.label}</span>
                <button onClick={() => deleteMember(m.id)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--t3)", cursor: "pointer", display: "grid", placeItems: "center", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.background = "var(--re-a)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un membre" width={440}>
        <AddForm onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); fetchData(); }} />
      </Modal>
      <Modal open={showOncall} onClose={() => setShowOncall(false)} title="Définir l'on-call" width={440}>
        <OncallForm members={members} onClose={() => setShowOncall(false)} onSet={() => { setShowOncall(false); fetchData(); }} />
      </Modal>
    </div>
  );
}

function AddForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", slack_username: "", role: "engineer" });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors: Record<string, string> = {}; if (touched.name && !form.name.trim()) errors.name = "Le nom est requis";
  const submit = async () => { setTouched({ name: true }); if (!form.name.trim()) return; setSaving(true); try { await axios.post(`${API_URL}/team/members`, { ...form, email: form.email || null, slack_username: form.slack_username || null }); onAdded(); } catch (e) { console.error(e); } finally { setSaving(false); } };
  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <FormField label="Nom" required error={errors.name}><input type="text" value={form.name} placeholder="Alice Dupont" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, name: true }))} style={{ ...formInput, borderColor: errors.name ? "var(--re)" : undefined }} /></FormField>
      <FormField label="Email"><input type="email" value={form.email} placeholder="alice@company.com" onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={formInput} /></FormField>
      <FormField label="Username Slack"><input type="text" value={form.slack_username} placeholder="alice.dupont" onChange={e => setForm(p => ({ ...p, slack_username: e.target.value }))} style={formInput} /></FormField>
      <FormField label="Rôle"><select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={formInput}><option value="sre">SRE</option><option value="devops">DevOps</option><option value="engineer">Engineer</option><option value="lead">Tech Lead</option><option value="manager">Manager</option></select></FormField>
      <FormActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "Ajout..." : "Ajouter"} submitting={saving} disabled={!form.name.trim()} />
    </div>
  );
}

function OncallForm({ members, onClose, onSet }: { members: Member[]; onClose: () => void; onSet: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => { if (!selectedId || !endDate) return; setSaving(true); try { await axios.post(`${API_URL}/team/oncall`, { member_id: selectedId, start_date: startDate, end_date: endDate }); onSet(); } catch (e) { console.error(e); } finally { setSaving(false); } };
  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <FormField label="Membre" required>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {members.map(m => (
            <div key={m.id} onClick={() => setSelectedId(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: selectedId === m.id ? "1.5px solid var(--t1)" : "1.5px solid var(--b2)", background: selectedId === m.id ? "var(--s2)" : "transparent", transition: "all 0.12s" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: selectedId === m.id ? "var(--t1)" : "var(--s3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: selectedId === m.id ? "#fff" : "var(--t2)" }}>{m.name.charAt(0).toUpperCase()}</div>
              <div><div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{m.name}</div>{m.slack_username && <div style={{ fontSize: 11, color: "var(--t3)" }}>@{m.slack_username}</div>}</div>
            </div>
          ))}
        </div>
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FormField label="Début"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={formInput} /></FormField>
        <FormField label="Fin" required><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={formInput} /></FormField>
      </div>
      <FormActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "Sauvegarde..." : "Confirmer"} submitting={saving} disabled={!selectedId || !endDate} />
    </div>
  );
}