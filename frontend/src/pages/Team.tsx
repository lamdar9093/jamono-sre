// Page équipe — gestion des membres et on-call
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Plus, X, Shield, Mail,
  Slack, RefreshCw, Star, UserCheck,
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface Member {
  id: number;
  name: string;
  email: string | null;
  slack_username: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const roleConfig: Record<string, { label: string; color: string }> = {
  engineer:  { label: "Engineer",   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  lead:      { label: "Tech Lead",  color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  manager:   { label: "Manager",    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  devops:    { label: "DevOps",     color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  sre:       { label: "SRE",        color: "text-green-400 bg-green-500/10 border-green-500/20" },
};

export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [oncall, setOncall] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOncallModal, setShowOncallModal] = useState(false);

  useEffect(() => { fetchTeam(); }, []);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/team`);
      setMembers(res.data.members);
      setOncall(res.data.oncall);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteMember = async (id: number) => {
    await axios.delete(`${API_URL}/team/members/${id}`);
    fetchTeam();
  };

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Équipe</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestion des membres et on-call</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTeam}
            className="flex items-center gap-2 px-3 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm font-mono transition-all"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm rounded transition-all font-mono"
          >
            <Plus size={15} />
            Ajouter un membre
          </button>
        </div>
      </div>

      {/* On-call actuel */}
      <div className={`rounded-lg border p-5 ${
        oncall
          ? "bg-green-500/5 border-green-500/20"
          : "bg-zinc-900 border-zinc-800"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${oncall ? "bg-green-500/20" : "bg-zinc-800"}`}>
              <Shield size={18} className={oncall ? "text-green-400" : "text-zinc-600"} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">On-Call maintenant</p>
              {oncall ? (
                <p className="text-lg font-bold text-green-400 font-mono">{oncall.name}</p>
              ) : (
                <p className="text-lg font-bold text-zinc-600 font-mono">Personne assigné</p>
              )}
              {oncall?.slack_username && (
                <p className="text-xs text-zinc-500 font-mono">@{oncall.slack_username}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowOncallModal(true)}
            disabled={members.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 text-xs font-mono transition-all disabled:opacity-40"
          >
            <UserCheck size={13} />
            Changer
          </button>
        </div>
      </div>

      {/* Liste membres */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
          <Users size={15} className="text-orange-500" />
          <span className="text-sm font-mono text-zinc-300 uppercase tracking-wide">
            {members.length} membre{members.length !== 1 ? "s" : ""}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users size={32} className="text-zinc-700" />
            <p className="text-zinc-600 font-mono text-sm">Aucun membre — ajoute ton équipe</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {members.map((member) => {
              const role = roleConfig[member.role] || roleConfig.engineer;
              const isOncall = oncall?.id === member.id;

              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/50 transition-all">

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-zinc-300">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">{member.name}</span>
                      {isOncall && (
                        <span className="flex items-center gap-1 text-xs text-green-400 font-mono px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                          <Star size={9} fill="currentColor" />
                          on-call
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {member.email && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <Mail size={9} />
                          {member.email}
                        </span>
                      )}
                      {member.slack_username && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <Slack size={9} />
                          @{member.slack_username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rôle */}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${role.color}`}>
                    {role.label}
                  </span>

                  {/* Supprimer */}
                  <button
                    onClick={() => deleteMember(member.id)}
                    className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal ajout membre */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); fetchTeam(); }}
        />
      )}

      {/* Modal on-call */}
      {showOncallModal && (
        <SetOncallModal
          members={members}
          onClose={() => setShowOncallModal(false)}
          onSet={() => { setShowOncallModal(false); fetchTeam(); }}
        />
      )}
    </div>
  );
}

// Modal ajout membre
function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", slack_username: "", role: "engineer"
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/team/members`, {
        ...form,
        email: form.email || null,
        slack_username: form.slack_username || null,
      });
      onAdded();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 placeholder-zinc-700";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-orange-500" />
            <span className="text-sm font-mono text-zinc-200 font-bold uppercase tracking-wide">
              Ajouter un membre
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Nom *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Alice Dupont" className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="alice@company.com" className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Username Slack</label>
            <input type="text" value={form.slack_username} onChange={(e) => setForm({ ...form, slack_username: e.target.value })}
              placeholder="alice.dupont" className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Rôle</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
              <option value="engineer">Engineer</option>
              <option value="sre">SRE</option>
              <option value="devops">DevOps</option>
              <option value="lead">Tech Lead</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm font-mono transition-all">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 rounded bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm font-mono transition-all">
              {saving ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal set on-call
function SetOncallModal({ members, onClose, onSet }: { members: Member[]; onClose: () => void; onSet: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedId || !endDate) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/team/oncall`, {
        member_id: selectedId,
        start_date: startDate,
        end_date: endDate,
      });
      onSet();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-orange-500" />
            <span className="text-sm font-mono text-zinc-200 font-bold uppercase tracking-wide">
              Définir l'on-call
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Membre *</label>
            <div className="space-y-2">
              {members.map((m) => (
                <button key={m.id} onClick={() => setSelectedId(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-all ${
                    selectedId === m.id
                      ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}>
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                    <span className="text-xs font-bold">{m.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold font-mono">{m.name}</p>
                    {m.slack_username && <p className="text-xs text-zinc-500 font-mono">@{m.slack_username}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2 block">Fin *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm font-mono transition-all">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={saving || !selectedId || !endDate}
              className="flex-1 py-2.5 rounded bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold text-sm font-mono transition-all">
              {saving ? "Sauvegarde..." : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}