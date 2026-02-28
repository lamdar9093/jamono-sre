import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Incidents from "./pages/Incidents";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import CopilotDrawer from "./components/CopilotDrawer";

function AppLayout() {
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
          padding: "22px",
          paddingRight: copilotOpen ? "365px" : "22px",
          background: "var(--bg)",
          transition: "padding-right 0.25s ease",
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/team" element={<Team />} />
          </Routes>
        </main>

        {/* Copilot Drawer */}
        <CopilotDrawer open={copilotOpen} />

        {/* Copilot FAB */}
        {!copilotOpen && (
          <button
            onClick={() => setCopilotOpen(true)}
            style={{
              position: "fixed",
              bottom: 22,
              right: 22,
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, var(--brand), #6366F1)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
              transition: "all 0.2s",
              zIndex: 60,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(59,130,246,0.5)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(59,130,246,0.4)"; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
            </svg>
          </button>
        )}

        {/* Copilot close zone — click outside to close */}
        {copilotOpen && (
          <div
            onClick={() => setCopilotOpen(false)}
            style={{
              position: "fixed",
              bottom: 22,
              right: 355,
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--s2)",
              border: "1px solid var(--b2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 60,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;