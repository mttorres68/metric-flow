/*
 * MetricFlow — Sidebar Component
 * Design: Pastel Command Center — sidebar com nav items e avatar
 * Suporta Dark Mode via ThemeContext
 */

import {
  BarChart2,
  BarChartHorizontal,
  CircleCheckBig,
  Home,
  LineChart,
  Map,
  MessageCircle,
  ShoppingCart,
  SquareUserRound,
  TrendingUp,
  UsersRound,
  ChevronLeft,
  Menu,
  Moon,
  Sun,
  Trello,
} from "lucide-react";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "vendedores", label: "Vendedores", icon: SquareUserRound },
  { id: "compliance", label: "Compliance", icon: CircleCheckBig },
  { id: "clientes", label: "Clientes", icon: UsersRound },
  { id: "relatorio", label: "Relatórios", icon: BarChart2 },
  { id: "relatorio_semanal", label: "Rel. Semanal", icon: BarChartHorizontal },
  { id: "rota_coaching", label: "Rota Coaching", icon: Map },
  { id: "analises", label: "Análises", icon: LineChart },
  { id: "trello_atraso", label: "Trello Atraso", icon: Trello },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },

  { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
  { id: "tendencias", label: "Tendências", icon: TrendingUp },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { isCollapsed, toggle } = useSidebarCollapse();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-30 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-60'} bg-white dark:bg-[var(--sidebar)] border-r border-slate-100 dark:border-[var(--sidebar-border)]`}
      style={{
        boxShadow: isDark
          ? "2px 0 20px rgba(0,0,0,0.35), inset -1px 0 0 oklch(0.265 0.018 252)"
          : "2px 0 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Logo and Toggle */}
      <div className={`px-4 py-5 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div className="whitespace-nowrap flex-shrink-0">
            <span className="font-900 text-slate-800 dark:text-slate-100 text-lg leading-tight block" style={{ fontWeight: 900 }}>
              MetricFlow
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-500 block">HNK</span>
          </div>
        </div>

        <button 
          onClick={toggle}
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
          title={isCollapsed ? "Expandir menu" : "Ocultar menu"}
        >
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="text-xs font-700 text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3">
            Menu
          </p>
        )}
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isBlocked = item.id !== "dashboard" && item.id !== "vendedores" && item.id !== "compliance" && item.id !== "clientes" && item.id !== "relatorio" && item.id !== "relatorio_semanal" && item.id !== "rota_coaching" && item.id !== "analises" && item.id !== "trello_atraso" && item.id !== "whatsapp";

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  disabled={isBlocked}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-600 transition-all duration-200 ${
                    isBlocked 
                      ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                      : isActive
                      ? "bg-indigo-50 dark:bg-[var(--sidebar-accent)] text-indigo-600 dark:text-[var(--sidebar-accent-foreground)] dark:[box-shadow:inset_2px_0_0_var(--sidebar-primary)]"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  style={{ fontWeight: isActive ? 700 : 500 }}
                  title={isBlocked ? "Esta seção está em desenvolvimento" : item.label}
                >
                  <Icon
                    className={`shrink-0 ${
                      isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                    style={{ width: "1.1rem", height: "1.1rem" }}
                  />
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {!isCollapsed && isActive && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Theme Toggle + Info */}
      <div className="px-4 py-4 border-t border-slate-100 dark:border-[var(--sidebar-border)]">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm transition-all duration-200 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-700 dark:hover:text-slate-200 mb-2`}
          title={isDark ? "Modo claro" : "Modo escuro"}
          style={{ fontWeight: 500 }}
        >
          {isDark
            ? <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            : <Moon className="w-4 h-4 text-indigo-400 shrink-0" />}
          {!isCollapsed && (
            <span className="truncate flex-1 text-left">
              {isDark ? "Modo Claro" : "Modo Escuro"}
            </span>
          )}
        </button>

        <div className="px-2 py-2 rounded-xl flex flex-col items-center">
          {!isCollapsed ? (
            <>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">MetricFlow v1.0</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 text-center mt-1 whitespace-nowrap">Dashboard Analytics</p>
            </>
          ) : (
             <p className="text-xs text-slate-400 dark:text-slate-500 text-center cursor-default" title="MetricFlow v1.0">v1</p>
          )}
        </div>
      </div>
    </aside>
  );
}
