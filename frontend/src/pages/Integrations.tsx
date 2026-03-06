import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_URL from "../config";
import Modal, { formInput, FormField, FormActions } from "../components/Modal";

/* ── Types ── */
interface ProviderField {
  key: string; label: string; type: string; required: boolean; placeholder?: string;
}
interface Provider {
  type: string; category: string; display_name: string; description: string;
  icon: string; config_schema: { fields: ProviderField[] };
}
interface ActiveIntegration {
  id: number; type: string; display_name: string; category: string;
  is_active: boolean; connected_at: string | null;
}

/* ── Design tokens ── */
const CAT: Record<string, { label: string; color: string }> = {
  ticketing: { label: "Ticketing", color: "#0052CC" },
  communication: { label: "Communication", color: "#6264A7" },
  alerting: { label: "Alerting", color: "#FF6B00" },
  custom: { label: "Custom", color: "var(--t2)" },
};
const IC: Record<string, { bg: string; fg: string; border: string; abbr: string; gradient: string }> = {
  jira:       { bg: "rgba(0,82,204,0.08)",  fg: "#0052CC", border: "rgba(0,82,204,0.18)", abbr: "JRA", gradient: "linear-gradient(135deg, #0052CC, #2684FF)" },
  slack:      { bg: "var(--slack-a)",        fg: "var(--slack)", border: "rgba(224,30,90,0.15)", abbr: "SLK", gradient: "linear-gradient(135deg, #E01E5A, #E0457B)" },
  teams:      { bg: "rgba(98,100,167,0.08)", fg: "#6264A7", border: "rgba(98,100,167,0.18)", abbr: "TMS", gradient: "linear-gradient(135deg, #6264A7, #7B83EB)" },
  servicenow: { bg: "rgba(0,133,55,0.08)",   fg: "#008537", border: "rgba(0,133,55,0.18)", abbr: "SNW", gradient: "linear-gradient(135deg, #008537, #1DB954)" },
  github:     { bg: "rgba(255,255,255,0.04)",fg: "#E6EDF3", border: "var(--b2)", abbr: "GH", gradient: "linear-gradient(135deg, #333, #666)" },
  opsgenie:   { bg: "rgba(54,79,199,0.08)",  fg: "#364FC7", border: "rgba(54,79,199,0.18)", abbr: "OG", gradient: "linear-gradient(135deg, #364FC7, #5C7CFA)" },
  pagerduty:  { bg: "rgba(6,167,0,0.08)",    fg: "#06A700", border: "rgba(6,167,0,0.18)", abbr: "PD", gradient: "linear-gradient(135deg, #06A700, #38D430)" },
  webhook:    { bg: "var(--s2)",             fg: "var(--t2)", border: "var(--b2)", abbr: "WH", gradient: "linear-gradient(135deg, var(--s3), var(--s2))" },
};
const ico = (t: string) => IC[t] || IC.webhook;

export default function Integrations() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [actives, setActives] = useState<ActiveIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [connectModal, setConnectModal] = useState<Provider | null>(null);
  const [configModal, setConfigModal] = useState<ActiveIntegration | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        axios.get(`${API_URL}/integrations/available`),
        axios.get(`${API_URL}/integrations`),
      ]);
      setProviders(p.data.providers ?? []);
      setActives(a.data.integrations ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeMap = new Map(actives.filter(a => a.is_active).map(a => [a.type, a]));
  const categories = [...new Set(providers.map(p => p.category))];
  const filtered = filterCat === "all" ? providers : providers.filter(p => p.category === filterCat);

  const disconnect = async (type: string) => {
    try { await axios.post(`${API_URL}/integrations/${type}/disconnect`); fetchAll(); } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.03em", margin: 0 }}>Intégrations</h1>
          <p style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: "var(--t3)", marginTop: 4 }}>
            Connectez vos outils pour automatiser la gestion des incidents
          </p>
        </div>
        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>
          <span style={{ color: "var(--g)", fontWeight: 600 }}>{activeMap.size}</span> active{activeMap.size !== 1 ? "s" : ""} · {providers.length} disponible{providers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Active strip ── */}
      {activeMap.size > 0 && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(52,211,153,0.04), rgba(59,130,246,0.04))",
          border: "1px solid rgba(52,211,153,0.12)", borderRadius: 10,
        }}>
          <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>
            Connectés
          </span>
          {[...activeMap.values()].map(a => {
            const c = ico(a.type);
            return (
              <div key={a.type} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 12px 5px 6px",
                borderRadius: 8, background: "var(--s1)", border: `1px solid ${c.border}`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, background: c.gradient,
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--fm)", fontSize: 7, fontWeight: 800, color: "#fff",
                }}>{c.abbr}</div>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11, fontWeight: 600, color: "var(--t1)" }}>{a.display_name}</span>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)", boxShadow: "0 0 6px var(--g)" }} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 4 }}>
        {[{ k: "all", l: "Toutes" }, ...categories.map(c => ({ k: c, l: CAT[c]?.label || c }))].map(f => (
          <button key={f.k} onClick={() => setFilterCat(f.k)} style={{
            padding: "6px 14px", borderRadius: 8, fontFamily: "var(--fm)", fontSize: 11,
            cursor: "pointer", fontWeight: filterCat === f.k ? 600 : 400, transition: "all 0.15s",
            border: filterCat === f.k ? "1px solid var(--brand-b)" : "1px solid transparent",
            background: filterCat === f.k ? "var(--brand-a)" : "transparent",
            color: filterCat === f.k ? "var(--brand2)" : "var(--t3)",
          }}>{f.l}</button>
        ))}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--b2)", borderTop: "2px solid var(--brand)", borderRadius: "50%", margin: "0 auto", animation: "spin 0.6s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {filtered.map(provider => {
            const active = activeMap.get(provider.type);
            const c = ico(provider.type);
            const cat = CAT[provider.category] || CAT.custom;
            return (
              <div key={provider.type} style={{
                background: "var(--s1)", border: `1px solid ${active ? c.border : "var(--b1)"}`,
                borderRadius: 10, overflow: "hidden", transition: "all 0.2s",
                boxShadow: active ? `0 0 20px ${c.fg}08` : "none",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = c.border; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = active ? c.border : "var(--b1)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
              >
                {/* Accent bar */}
                <div style={{ height: 2, background: c.gradient, opacity: active ? 1 : 0.2 }} />

                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Top */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, background: c.gradient,
                        display: "grid", placeItems: "center", boxShadow: `0 4px 12px ${c.fg}25`,
                        fontFamily: "var(--fm)", fontSize: 11, fontWeight: 800, color: "#fff",
                      }}>{c.abbr}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{provider.display_name}</div>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: cat.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{cat.label}</span>
                      </div>
                    </div>
                    {active && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "3px 10px",
                        borderRadius: 6, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)", boxShadow: "0 0 4px var(--g)" }} />
                        <span style={{ fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600, color: "var(--g)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actif</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: "var(--t3)", lineHeight: 1.6, margin: 0 }}>
                    {provider.description}
                  </p>

                  {/* Actions */}
                  {active ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setConfigModal(active)} style={{
                        flex: 1, padding: "9px 0", borderRadius: 8,
                        fontFamily: "var(--fm)", fontSize: 11.5, fontWeight: 600,
                        cursor: "pointer", border: `1px solid ${c.border}`,
                        background: `${c.fg}08`, color: c.fg, transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${c.fg}15`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${c.fg}08`; }}
                      >Configurer</button>
                      <button onClick={() => disconnect(provider.type)} style={{
                        padding: "9px 14px", borderRadius: 8,
                        fontFamily: "var(--fm)", fontSize: 11.5, fontWeight: 500,
                        cursor: "pointer", border: "1px solid transparent",
                        background: "transparent", color: "var(--t3)", transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--re)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.18)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                      >Déconnecter</button>
                    </div>
                  ) : (
                    <button onClick={() => setConnectModal(provider)} style={{
                      width: "100%", padding: "10px 0", borderRadius: 8,
                      fontFamily: "var(--f)", fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em",
                      cursor: "pointer", border: "none", color: "#fff",
                      background: c.gradient, transition: "all 0.15s",
                      boxShadow: `0 2px 8px ${c.fg}20`,
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${c.fg}35`; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${c.fg}20`; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                    >Connecter</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Connect Modal ── */}
      <Modal open={!!connectModal} onClose={() => setConnectModal(null)} title={connectModal ? `Connecter ${connectModal.display_name}` : ""} width={480}>
        {connectModal && <ConnectForm provider={connectModal} onClose={() => setConnectModal(null)} onConnected={() => { setConnectModal(null); fetchAll(); }} />}
      </Modal>

      {/* ── Configure Modal ── */}
      <Modal open={!!configModal} onClose={() => setConfigModal(null)} title={configModal ? `Configurer ${configModal.display_name}` : ""} width={520}>
        {configModal && <ConfigPanel integration={configModal} onClose={() => setConfigModal(null)} onSaved={() => { setConfigModal(null); fetchAll(); }} />}
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Connect Form — credentials only
   ═══════════════════════════════════════════ */
function ConnectForm({ provider, onClose, onConnected }: { provider: Provider; onClose: () => void; onConnected: () => void }) {
  const fields = provider.config_schema.fields.filter(f => f.type !== "toggle");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = ""; });
    return init;
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: Record<string, string> = {};
  fields.forEach(f => { if (f.required && touched[f.key] && !form[f.key]) errors[f.key] = "Requis"; });
  const hasRequired = fields.filter(f => f.required).every(f => form[f.key]);

  const c = ico(provider.type);

  const testConn = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await axios.post(`${API_URL}/integrations/${provider.type}/test`, { credentials: form });
      setTestResult({ connected: res.data.connected, message: res.data.message });
    } catch (e: any) { setTestResult({ connected: false, message: e.response?.data?.detail || "Erreur réseau" }); }
    finally { setTesting(false); }
  };

  const connect = async () => {
    const allTouched: Record<string, boolean> = {};
    fields.forEach(f => { allTouched[f.key] = true; });
    setTouched(allTouched);
    if (!hasRequired) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/integrations/${provider.type}/connect`, { credentials: form });
      onConnected();
    } catch (e: any) { setTestResult({ connected: false, message: e.response?.data?.detail || "Erreur" }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Provider banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        borderRadius: 10, background: `${c.fg}06`, border: `1px solid ${c.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: c.gradient,
          display: "grid", placeItems: "center",
          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 800, color: "#fff",
        }}>{c.abbr}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{provider.display_name}</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>{provider.description}</div>
        </div>
      </div>

      {/* Credential fields */}
      {fields.map(f => (
        <FormField key={f.key} label={f.label} required={f.required} error={errors[f.key]}>
          <input
            type={f.type === "password" ? "password" : "text"}
            value={form[f.key] || ""}
            placeholder={f.placeholder || ""}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            onBlur={() => setTouched(p => ({ ...p, [f.key]: true }))}
            style={{ ...formInput, borderColor: errors[f.key] ? "var(--re)" : undefined }}
          />
        </FormField>
      ))}

      {/* Test result */}
      {testResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8,
          background: testResult.connected ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)",
          border: `1px solid ${testResult.connected ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)"}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: testResult.connected ? "var(--g)" : "var(--re)" }} />
          <span style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: testResult.connected ? "var(--g)" : "var(--re)", fontWeight: 500 }}>{testResult.message}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
        <button onClick={testConn} disabled={testing || !hasRequired} style={{
          padding: "9px 18px", borderRadius: 8, fontFamily: "var(--fm)", fontSize: 12, fontWeight: 500,
          cursor: (testing || !hasRequired) ? "not-allowed" : "pointer",
          border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)",
          opacity: (testing || !hasRequired) ? 0.4 : 1, transition: "all 0.15s",
        }}>{testing ? "Test..." : "Tester la connexion"}</button>
        <FormActions onCancel={onClose} onSubmit={connect} submitLabel={saving ? "Connexion..." : "Connecter"} submitting={saving} disabled={!hasRequired} />
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Config Panel — post-connection settings
   ═══════════════════════════════════════════ */
function ConfigPanel({ integration, onClose, onSaved }: { integration: ActiveIntegration; onClose: () => void; onSaved: () => void }) {
  if (integration.type === "jira") return <JiraConfigPanel onClose={onClose} onSaved={onSaved} />;
  if (integration.type === "teams") return <TeamsConfigPanel onClose={onClose} onSaved={onSaved} />;
  return (
    <div style={{ padding: "20px 22px", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--t3)" }}>Configuration disponible prochainement.</p>
      <button onClick={onClose} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--b2)", background: "transparent", color: "var(--t2)", cursor: "pointer", fontFamily: "var(--fm)", fontSize: 12 }}>Fermer</button>
    </div>
  );
}


/* ── Jira Config ── */
function JiraConfigPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [projects, setProjects] = useState<{ id: string; key: string; name: string; avatar: string }[]>([]);
  const [issueTypes, setIssueTypes] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState("");
  const [autoCreate, setAutoCreate] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingProjects(true);
    axios.get(`${API_URL}/integrations/jira/discover/projects`)
      .then(r => setProjects(r.data.resources ?? []))
      .catch(e => console.error(e))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) { setIssueTypes([]); return; }
    setLoadingTypes(true);
    setSelectedIssueType("");
    axios.get(`${API_URL}/integrations/jira/discover/issue_types?project_key=${selectedProject}`)
      .then(r => {
        const types = r.data.resources ?? [];
        setIssueTypes(types);
        if (types.length > 0) setSelectedIssueType(types[0].name);
      })
      .catch(e => console.error(e))
      .finally(() => setLoadingTypes(false));
  }, [selectedProject]);

  const save = async () => {
    if (!selectedProject || !selectedIssueType) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/integrations/jira/config`, {
        config: { project_key: selectedProject, issue_type: selectedIssueType, auto_create: autoCreate },
      });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const c = IC.jira;

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        borderRadius: 10, background: `${c.fg}06`, border: `1px solid ${c.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: c.gradient,
          display: "grid", placeItems: "center",
          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 800, color: "#fff",
        }}>{c.abbr}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Configuration Jira</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>Choisissez le projet et le type de ticket par défaut</div>
        </div>
      </div>

      {/* Project selector */}
      <FormField label="Projet Jira" required>
        {loadingProjects ? (
          <div style={{ ...formInput, display: "flex", alignItems: "center", gap: 8, color: "var(--t3)" }}>
            <div style={{ width: 12, height: 12, border: "1.5px solid var(--b2)", borderTop: "1.5px solid var(--brand)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>Chargement des projets...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {projects.map(p => (
              <button key={p.key} onClick={() => setSelectedProject(p.key)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                border: selectedProject === p.key ? `1.5px solid ${c.fg}` : "1.5px solid var(--b1)",
                background: selectedProject === p.key ? `${c.fg}08` : "var(--s2)",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (selectedProject !== p.key) (e.currentTarget as HTMLElement).style.borderColor = c.border; }}
                onMouseLeave={e => { if (selectedProject !== p.key) (e.currentTarget as HTMLElement).style.borderColor = "var(--b1)"; }}
              >
                {p.avatar && <img src={p.avatar} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />}
                <div style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600, color: selectedProject === p.key ? c.fg : "var(--t1)" }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginLeft: 8 }}>{p.key}</span>
                </div>
                {selectedProject === p.key && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={c.fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="13 4 6 11 3 8"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </FormField>

      {/* Issue type selector */}
      {selectedProject && (
        <FormField label="Type de ticket" required>
          {loadingTypes ? (
            <div style={{ ...formInput, display: "flex", alignItems: "center", gap: 8, color: "var(--t3)" }}>
              <div style={{ width: 12, height: 12, border: "1.5px solid var(--b2)", borderTop: "1.5px solid var(--brand)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              <span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>Chargement...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {issueTypes.map(t => (
                <button key={t.id} onClick={() => setSelectedIssueType(t.name)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  border: selectedIssueType === t.name ? `1.5px solid ${c.fg}` : "1.5px solid var(--b1)",
                  background: selectedIssueType === t.name ? `${c.fg}08` : "transparent",
                  transition: "all 0.15s",
                }}>
                  {t.icon && <img src={t.icon} alt="" style={{ width: 14, height: 14 }} />}
                  <span style={{
                    fontFamily: "var(--fm)", fontSize: 11, fontWeight: selectedIssueType === t.name ? 600 : 400,
                    color: selectedIssueType === t.name ? c.fg : "var(--t2)",
                  }}>{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </FormField>
      )}

      {/* Auto-create toggle */}
      {selectedProject && selectedIssueType && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 8,
          background: autoCreate ? "rgba(52,211,153,0.04)" : "var(--s2)",
          border: `1px solid ${autoCreate ? "rgba(52,211,153,0.15)" : "var(--b1)"}`,
          transition: "all 0.15s",
        }}>
          <div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Création automatique</div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Pré-cocher Jira dans les actions lors de la création d'un incident</div>
          </div>
          <button onClick={() => setAutoCreate(!autoCreate)} style={{
            width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
            background: autoCreate ? "var(--g)" : "var(--s3)",
            position: "relative", transition: "background 0.15s", flexShrink: 0,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, left: autoCreate ? 21 : 3,
              transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>
      )}

      {/* Summary */}
      {selectedProject && selectedIssueType && (
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: "var(--s2)", border: "1px solid var(--b1)",
          fontFamily: "var(--fm)", fontSize: 11, color: "var(--t2)", lineHeight: 1.6,
        }}>
          Les incidents créeront des tickets <span style={{ color: c.fg, fontWeight: 600 }}>{selectedIssueType}</span> dans le projet <span style={{ color: c.fg, fontWeight: 600 }}>{selectedProject}</span>.
        </div>
      )}

      <FormActions onCancel={onClose} onSubmit={save} submitLabel={saving ? "Enregistrement..." : "Enregistrer"} submitting={saving} disabled={!selectedProject || !selectedIssueType} />
    </div>
  );
}


/* ── Teams Config ── */
function TeamsConfigPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [autoNotify, setAutoNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const c = IC.teams;

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/integrations/teams/config`, { config: { auto_notify: autoNotify } });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        borderRadius: 10, background: `${c.fg}06`, border: `1px solid ${c.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: c.gradient,
          display: "grid", placeItems: "center",
          fontFamily: "var(--fm)", fontSize: 9, fontWeight: 800, color: "#fff",
        }}>{c.abbr}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Configuration Teams</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)" }}>Paramètres de notification</div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 8,
        background: autoNotify ? "rgba(52,211,153,0.04)" : "var(--s2)",
        border: `1px solid ${autoNotify ? "rgba(52,211,153,0.15)" : "var(--b1)"}`,
        transition: "all 0.15s",
      }}>
        <div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Notification automatique</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Poster dans Teams à chaque création/mise à jour d'incident</div>
        </div>
        <button onClick={() => setAutoNotify(!autoNotify)} style={{
          width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
          background: autoNotify ? "var(--g)" : "var(--s3)",
          position: "relative", transition: "background 0.15s", flexShrink: 0,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 3, left: autoNotify ? 21 : 3,
            transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
      </div>

      <FormActions onCancel={onClose} onSubmit={save} submitLabel={saving ? "Enregistrement..." : "Enregistrer"} submitting={saving} />
    </div>
  );
}