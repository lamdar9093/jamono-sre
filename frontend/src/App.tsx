import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Incidents from "./pages/Incidents";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import Clusters from "./pages/Clusters";
import CopilotDrawer from "./components/CopilotDrawer";
import Integrations from "./pages/Integrations";

function AppContent() {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "240px 1fr",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg)",
      color: "var(--t1)",
      fontFamily: "var(--f)",
    }}>
      <Sidebar />
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <TopBar onDeclareIncident={() => navigate("/incidents")} />
        <main style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px 22px",
          paddingRight: copilotOpen ? "365px" : "22px",
          background: "var(--bg)",
          transition: "padding-right 0.25s ease",
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/team" element={<Team />} />
            <Route path="/integrations" element={<Integrations />} />
          </Routes>
        </main>

        {/* ── Copilot toggle ── */}
        {!copilotOpen ? (
          <button
            onClick={() => setCopilotOpen(true)}
            style={{
              position: "fixed", bottom: 20, right: 20, zIndex: 60,
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, var(--brand), #6366f1)",
              border: "none", cursor: "pointer",
              display: "grid", placeItems: "center",
              boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
              transition: "all 0.2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v4M6 4h4M2 8h2M12 8h2M4 12l1.5-1.5M10.5 10.5L12 12M4 4l1.5 1.5M10.5 5.5L12 4"/>
              <circle cx="8" cy="8" r="2"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={() => setCopilotOpen(false)}
            style={{
              position: "fixed", top: 60, right: 348, zIndex: 60,
              width: 28, height: 28, borderRadius: 8,
              background: "var(--s1)", border: "1px solid var(--b2)",
              cursor: "pointer", display: "grid", placeItems: "center",
              boxShadow: "-2px 0 8px rgba(0,0,0,0.2)",
              transition: "all 0.2s",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round">
              <path d="M4 8h8M9 5l3 3-3 3"/>
            </svg>
          </button>
        )}

        <CopilotDrawer open={copilotOpen} />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;