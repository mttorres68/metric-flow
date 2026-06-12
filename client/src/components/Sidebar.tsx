/*
 * MetricFlow — Sidebar Component
 * Design: Pastel Command Center — sidebar com nav items e avatar
 * Suporta Dark Mode via ThemeContext
 */

import {
  Award,
  BarChart2,
  BarChartHorizontal,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Home,
  LineChart,
  Map,
  Menu,
  MessageCircle,
  Moon,
  ShoppingCart,
  SquareUserRound,
  Sun,
  Trello,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useTheme } from "@/contexts/ThemeContext";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NavSubItem {
  id: string;
  label: string;
  route: string;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  children?: NavSubItem[];
  blocked?: boolean;
}

// ─── Dados de navegação ────────────────────────────────────────────────────────

const navItems: NavItemDef[] = [
  { id: "dashboard",        label: "Dashboard",     icon: Home,              route: "/" },
  { id: "vendedores",       label: "Vendedores",    icon: SquareUserRound,   route: "/vendedores" },
  { id: "compliance",       label: "Compliance",    icon: CircleCheckBig,    route: "/compliance" },
  { id: "clientes",         label: "Clientes",      icon: UsersRound,        route: "/clientes" },
  { id: "relatorio",        label: "Relatórios",    icon: BarChart2,         route: "/relatorio" },
  { id: "relatorio_semanal",label: "Rel. Semanal",  icon: BarChartHorizontal,route: "/relatorio-semanal" },
  { id: "rota_coaching",    label: "Rota Coaching", icon: Map,               route: "/rota-coaching" },
  {
    id: "analises",
    label: "Análise",
    icon: LineChart,
    children: [
      { id: "analise_diaria",     label: "Diária",       route: "/analises" },
      { id: "analise_semanal",    label: "Recorrência",  route: "/analises/semanal" },
    ],
  },
  { id: "trello_atraso",    label: "Trello Atraso", icon: Trello,            route: "/trello-atraso" },
  { id: "agenda_gv",        label: "Agenda GV",     icon: CalendarDays,      route: "/agenda-gv" },
  { id: "whatsapp",         label: "WhatsApp",      icon: MessageCircle,     route: "/whatsapp" },
  { id: "assessment",       label: "Assessment",    icon: Award,             route: "/assessment" },

  { id: "pedidos",          label: "Pedidos",       icon: ShoppingCart,      blocked: true },
  { id: "tendencias",       label: "Tendências",    icon: TrendingUp,        blocked: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGroupActive(item: NavItemDef, activePage: string): boolean {
  if (item.children) return item.children.some(c => c.id === activePage);
  return activePage === item.id;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { isCollapsed, toggle } = useSidebarCollapse();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();

  // Abre automaticamente o grupo que contém a página ativa
  const defaultOpen = navItems.find(i => i.children?.some(c => c.id === activePage))?.id ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(defaultOpen);

  function handleGroupToggle(id: string) {
    setOpenGroup(prev => (prev === id ? null : id));
  }

  function navigateTo(route: string) {
    setLocation(route);
  }

  const activeClasses = "bg-indigo-50 dark:bg-[var(--sidebar-accent)] text-indigo-600 dark:text-[var(--sidebar-accent-foreground)]";
  const idleClasses   = "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-700 dark:hover:text-slate-200";
  const iconBase      = "shrink-0 transition-colors";

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-30 transition-all duration-300 ${isCollapsed ? "w-20" : "w-60"} bg-white dark:bg-[var(--sidebar)] border-r border-slate-100 dark:border-[var(--sidebar-border)]`}
      style={{
        boxShadow: isDark
          ? "2px 0 20px rgba(0,0,0,0.35), inset -1px 0 0 oklch(0.265 0.018 252)"
          : "2px 0 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Logo e toggle ── */}
      <div className={`px-4 py-5 border-b border-slate-100 dark:border-[var(--sidebar-border)] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"}`}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}>
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div className="whitespace-nowrap flex-shrink-0">
            <span className="text-slate-800 dark:text-slate-100 text-lg leading-tight block" style={{ fontWeight: 900 }}>MetricFlow</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 block">HNK</span>
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

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3" style={{ fontWeight: 700 }}>
            Menu
          </p>
        )}
        <ul className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isBlocked = !!item.blocked;
            const groupActive = isGroupActive(item, activePage);

            // ── Item com filhos (dropdown) ─────────────────────────────────
            if (item.children) {
              const isOpen = openGroup === item.id;

              return (
                <li key={item.id}>
                  {/* Cabeçalho do grupo */}
                  <button
                    onClick={() => {
                      if (isCollapsed) {
                        // No modo colapsado, navega direto para a primeira rota do grupo
                        navigateTo(item.children![0].route);
                      } else {
                        handleGroupToggle(item.id);
                      }
                    }}
                    className={`w-full flex items-center ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"} py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      groupActive ? activeClasses : idleClasses
                    }`}
                    style={{ fontWeight: groupActive ? 700 : 500 }}
                    title={item.label}
                  >
                    <Icon
                      className={`${iconBase} ${groupActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                      style={{ width: "1.1rem", height: "1.1rem" }}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        }
                      </>
                    )}
                  </button>

                  {/* Sub-itens — visíveis apenas no modo expandido */}
                  {!isCollapsed && isOpen && (
                    <ul className="mt-0.5 ml-3 pl-3 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-0.5">
                      {item.children.map(child => {
                        const childActive = activePage === child.id;
                        return (
                          <li key={child.id}>
                            <button
                              onClick={() => navigateTo(child.route)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150 ${
                                childActive
                                  ? "bg-indigo-50 dark:bg-[var(--sidebar-accent)] text-indigo-600 dark:text-indigo-400"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-700 dark:hover:text-slate-200"
                              }`}
                              style={{ fontWeight: childActive ? 700 : 500 }}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${childActive ? "bg-indigo-500 dark:bg-indigo-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                              {child.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            // ── Item simples ──────────────────────────────────────────────
            const isActive = activePage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    if (isBlocked) return;
                    if (item.route) navigateTo(item.route);
                    else onNavigate(item.id);
                  }}
                  disabled={isBlocked}
                  className={`w-full flex items-center ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"} py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isBlocked
                      ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                      : isActive
                      ? activeClasses
                      : idleClasses
                  }`}
                  style={{ fontWeight: isActive ? 700 : 500 }}
                  title={isBlocked ? "Esta seção está em desenvolvimento" : item.label}
                >
                  <Icon
                    className={`${iconBase} ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                    style={{ width: "1.1rem", height: "1.1rem" }}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Footer / Tema ── */}
      <div className="px-4 py-4 border-t border-slate-100 dark:border-[var(--sidebar-border)]">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3 px-3"} py-2.5 rounded-xl text-sm transition-all duration-200 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--accent)] hover:text-slate-700 dark:hover:text-slate-200 mb-2`}
          title={isDark ? "Modo claro" : "Modo escuro"}
          style={{ fontWeight: 500 }}
        >
          {isDark
            ? <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            : <Moon className="w-4 h-4 text-indigo-400 shrink-0" />}
          {!isCollapsed && (
            <span className="truncate flex-1 text-left">{isDark ? "Modo Claro" : "Modo Escuro"}</span>
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
