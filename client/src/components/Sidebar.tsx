/*
 * MetricFlow — Sidebar Component
 * Design: Pastel Command Center — sidebar branca com nav items e avatar
 */

import {
  BarChart2,
  Home,
  LineChart,
  Map,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "vendedores", label: "Vendedores", icon: Users },
  { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
  { id: "rotas", label: "Rotas", icon: Map },
  { id: "tendencias", label: "Tendências", icon: TrendingUp },
  { id: "relatorios", label: "Relatórios", icon: BarChart2 },
  { id: "analises", label: "Análises", icon: LineChart },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-slate-100 flex flex-col z-30"
      style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-900 text-slate-800 text-lg leading-tight block" style={{ fontWeight: 900 }}>
              MetricFlow
            </span>
            <span className="text-xs text-slate-400 font-500">Duttra SRN</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-xs font-700 text-slate-400 uppercase tracking-widest px-3 mb-3">
          Menu
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  disabled={item.id !== "dashboard" && item.id !== "vendedores"}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-600 transition-all duration-200 ${
                    item.id !== "dashboard" && item.id !== "vendedores"
                      ? "text-slate-300 cursor-not-allowed opacity-50"
                      : isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                  style={{ fontWeight: isActive ? 700 : 500 }}
                  title={item.id !== "dashboard" && item.id !== "vendedores" ? "Esta seção está em desenvolvimento" : ""}
                >
                  <Icon
                    className={`w-4.5 h-4.5 flex-shrink-0 ${
                      isActive ? "text-indigo-500" : "text-slate-400"
                    }`}
                    style={{ width: "1.1rem", height: "1.1rem" }}
                  />
                  {item.label}
                  {isActive && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Info */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="px-2 py-2 rounded-xl">
          <p className="text-xs text-slate-400 text-center">MetricFlow v1.0</p>
          <p className="text-xs text-slate-300 text-center mt-1">Dashboard Analytics</p>
        </div>
      </div>
    </aside>
  );
}
