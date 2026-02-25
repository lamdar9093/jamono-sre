import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  History,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clusters", icon: Server, label: "Clusters" },
  { to: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { to: "/history", icon: History, label: "Historique" },
  { to: "/settings", icon: Settings, label: "Paramètres" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-widest text-orange-500 uppercase font-mono">
          Jamono
        </span>
        <p className="text-xs text-zinc-500 mt-0.5 tracking-wider">
          SRE Copilot
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 ${
                isActive
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              }`
            }
          >
            <Icon size={16} />
            <span className="tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Statut en bas */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-500 font-mono">API connectée</span>
        </div>
      </div>

    </aside>
  );
}