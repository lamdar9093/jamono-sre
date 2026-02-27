import { useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import API_URL from "../../config";

const routeLabels: Record<string, string> = {
  "/": "dashboard",
  "/incidents": "incidents",
  "/history": "historique",
  "/settings": "paramètres",
  "/team": "équipe",
  "/connectors": "connecteurs",
};

export default function TopBar() {
  const location = useLocation();
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      await axios.post(`${API_URL}/monitor/scan`);
      setLastScan(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const page = routeLabels[location.pathname] || "jamono";

  return (
    <div style={{
      height: 44,
      background: "var(--s1)",
      borderBottom: "1px solid var(--b1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 18px",
      flexShrink: 0,
      gap: 12,
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          fontFamily: "var(--fm)",
          fontSize: 10.5,
          color: "var(--t3)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <span style={{ color: "var(--t2)" }}>cluster</span>
          {" / "}
          <span style={{ color: "var(--t2)" }}>k3d-local</span>
          {" / "}
          <span style={{ color: "var(--t1)" }}>{page}</span>
        </div>

        <div style={{ width: 1, height: 14, background: "var(--b2)" }} />

        <div style={{
          fontFamily: "var(--fm)",
          fontSize: 10,
          color: "var(--t3)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <div style={{
            width: 4, height: 4,
            background: lastScan ? "var(--g)" : "var(--t3)",
            borderRadius: "50%",
          }} />
          {lastScan ? `scan à ${lastScan}` : "aucun scan récent"}
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 5,
            fontFamily: "var(--f)",
            fontSize: 11,
            fontWeight: 500,
            cursor: scanning ? "not-allowed" : "pointer",
            border: "1px solid var(--b2)",
            background: "transparent",
            color: scanning ? "var(--t3)" : "var(--t2)",
            transition: "all 0.1s",
          }}
          onMouseEnter={e => {
            if (!scanning) {
              (e.currentTarget as HTMLElement).style.background = "var(--s2)";
              (e.currentTarget as HTMLElement).style.color = "var(--t1)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = scanning ? "var(--t3)" : "var(--t2)";
          }}
        >
          <svg
            width="11" height="11"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ animation: scanning ? "spin 1s linear infinite" : "none" }}
          >
            <path d="M13 7A6 6 0 101 7"/>
            <path d="M13 7l-2-2M13 7l-2 2"/>
          </svg>
          {scanning ? "Scan..." : "Actualiser"}
        </button>

        {/* Notif */}
        <div style={{
          width: 28, height: 28,
          borderRadius: 5,
          border: "1px solid var(--b2)",
          background: "transparent",
          color: "var(--t2)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.1s",
        }}>
          <div style={{
            position: "absolute",
            top: 3, right: 3,
            width: 5, height: 5,
            background: "var(--re)",
            borderRadius: "50%",
            border: "1.5px solid var(--s1)",
          }} />
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M7 1.5a4.5 4.5 0 014.5 4.5v3l1 2H1.5l1-2V6A4.5 4.5 0 017 1.5zM5.5 12a1.5 1.5 0 003 0"/>
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}