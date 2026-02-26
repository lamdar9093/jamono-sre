import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Incidents from "./pages/Incidents";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
        
        {/* Sidebar gauche - navigation */}
        <Sidebar />

        {/* Zone principale */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          
          {/* Contenu des pages */}
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;