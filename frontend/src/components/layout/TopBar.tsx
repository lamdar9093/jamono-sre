import { Bell, RefreshCw, Terminal } from "lucide-react";

export default function TopBar() {
  return (
    <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      
      {/* Gauche : contexte de la page */}
      <div className="flex items-center gap-3">
        <Terminal size={16} className="text-orange-500" />
        <span className="text-sm font-mono text-zinc-300 tracking-wide">
          cluster / <span className="text-orange-400">k3d-local</span>
        </span>
      </div>

      {/* Droite : actions globales */}
      <div className="flex items-center gap-4">
        
        {/* Dernière mise à jour */}
        <span className="text-xs font-mono text-zinc-600">
          dernière analyse : <span className="text-zinc-400">--:--</span>
        </span>

        {/* Bouton refresh */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-all text-xs font-mono">
          <RefreshCw size={13} />
          Actualiser
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
          <Bell size={16} />
          {/* Badge notification */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
        </button>

      </div>
    </header>
  );
}