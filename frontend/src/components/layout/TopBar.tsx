import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../../config";

const routeLabels: Record<string, string> = {
  "/": "dashboard",
  "/clusters": "clusters",
  "/incidents": "incidents",
  "/history": "historique",
  "/settings": "paramètres",
  "/team": "équipe",
  "/connectors": "connecteurs",
};

export default function TopBar({ onDeclareIncident, onScan }: { onDeclareIncident?: () => void; onScan?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  // const handleScan = async () => {
  //   setScanning(true);
  //   try {
  //     await axios.post(`${API_URL}/monitor/scan`);
  //     setLastScan(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  //   } catch (e) {
  //     console.error(e);
  //   } finally {
  //     setScanning(false);
  //   }
  // };

  const page = routeLabels[location.pathname] || "jamono";

  return (
    <div style={{
      height: 48,
      background: "var(--s1)",
      borderBottom: "1px solid var(--b1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 22px",
      flexShrink: 0,
      gap: 12,
    }}>
      {/* Left — Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Provider mini badge */}
        <div style={{
          width: 18, height: 18, borderRadius: 4,
          background: "var(--k3s)18", border: "1px solid var(--k3s)30",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--fm)", fontSize: 7, fontWeight: 800, color: "var(--k3s)",
        }}>
          K3s
        </div>

        <div style={{
          fontFamily: "var(--fm)",
          fontSize: 11,
          color: "var(--t3)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <span style={{ color: "var(--t2)" }}>k3d-local</span>
          <span style={{ color: "var(--b3)" }}>/</span>
          <span style={{ color: "var(--t1)", fontWeight: 600 }}>{page}</span>
        </div>

        <div style={{ width: 1, height: 16, background: "var(--b2)" }} />

        <div style={{
          fontFamily: "var(--fm)",
          fontSize: 10,
          color: "var(--t3)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <div style={{
            width: 5, height: 5,
            background: lastScan ? "var(--g)" : "var(--t3)",
            borderRadius: "50%",
            boxShadow: lastScan ? "0 0 4px var(--g)" : "none",
          }} />
          {lastScan ? `scan à ${lastScan}` : "aucun scan récent"}
        </div>
      </div>

      {/* Right — Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Declare incident */}
        <button
          onClick={() => {
            if (onDeclareIncident) onDeclareIncident();
            else navigate("/incidents");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: "var(--r)",
            fontFamily: "var(--f)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            background: "var(--re)",
            color: "#fff",
            boxShadow: "0 2px 10px rgba(248,113,113,0.25)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(248,113,113,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(248,113,113,0.25)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
          </svg>
          Déclarer un incident
        </button>

        {/* Scan
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            borderRadius: "var(--r)",
            fontFamily: "var(--f)",
            fontSize: 12,
            fontWeight: 500,
            cursor: scanning ? "not-allowed" : "pointer",
            border: "1px solid var(--b2)",
            background: "transparent",
            color: scanning ? "var(--t3)" : "var(--t2)",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            if (!scanning) {
              (e.currentTarget as HTMLElement).style.background = "var(--s2)";
              (e.currentTarget as HTMLElement).style.color = "var(--t1)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = scanning ? "var(--t3)" : "var(--t2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)";
          }}
        >
          <svg
            width="12" height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ animation: scanning ? "spin 1s linear infinite" : "none" }}
          >
            <path d="M14.5 8A6.5 6.5 0 101.5 8"/>
            <path d="M14.5 8l-2.2-2.2M14.5 8l-2.2 2.2"/>
          </svg>
          {scanning ? "Scan..." : "Scan"}
        </button> */}

        {/* Notifications */}
        <button
          style={{
            width: 34, height: 34,
            borderRadius: "var(--r)",
            border: "1px solid var(--b2)",
            background: "transparent",
            color: "var(--t2)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            position: "relative",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--s2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)";
          }}
        >
          <div style={{
            position: "absolute",
            top: 5, right: 5,
            width: 6, height: 6,
            background: "var(--re)",
            borderRadius: "50%",
            border: "1.5px solid var(--s1)",
          }} />
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 2a5 5 0 015 5v3.5l1 2H2l1-2V7a5 5 0 015-5zM6.5 13.5a1.5 1.5 0 003 0"/>
          </svg>
        </button>
      </div>
    </div>
  );
}