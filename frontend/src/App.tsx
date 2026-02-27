import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Incidents from "./pages/Incidents";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import CopilotDrawer from "./components/CopilotDrawer";

function App() {
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <BrowserRouter>
      <div style={{
        display: "grid",
        gridTemplateColumns: "188px 1fr",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--t1)",
        fontFamily: "var(--f)"
      }}>
        <Sidebar />
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          <TopBar />
          <main style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px",
            paddingRight: copilotOpen ? "338px" : "18px",
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

          {/* Tab toggle */}
          <div
            onClick={() => setCopilotOpen(o => !o)}
            style={{
              position: "fixed",
              right: copilotOpen ? 320 : 0,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 60,
              cursor: "pointer",
              transition: "right 0.25s ease",
            }}
          >
            <div style={{
              background: "var(--s1)",
              border: "1px solid var(--b2)",
              borderRight: "none",
              borderRadius: "6px 0 0 6px",
              padding: "12px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              boxShadow: "-3px 0 12px rgba(0,0,0,0.3)",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--bl)",
                boxShadow: "0 0 6px var(--bl)",
              }} />
              <span style={{
                fontFamily: "var(--fm)",
                fontSize: 8,
                color: "var(--bl)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                writingMode: "vertical-rl",
                userSelect: "none",
              }}>
                Copilot
              </span>
              <span style={{
                fontFamily: "var(--fm)",
                fontSize: 10,
                color: "var(--t3)",
                transform: copilotOpen ? "rotate(90deg)" : "rotate(-90deg)",
                transition: "transform 0.2s",
              }}>
                ›
              </span>
            </div>
          </div>

          <CopilotDrawer open={copilotOpen} />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;