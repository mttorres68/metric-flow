/*
 * MetricFlow — KPI Card Component
 * Design: Pastel Command Center — cards pastéis com ícone colorido e indicador de tendência
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "./ui/badge";

interface KPICardProps {
  title: string;
  value: string | number;
  numericValue?: number;
  prefix?: string;
  suffix?: string;
  trend?: number; // percentual positivo ou negativo
  trendLabel?: string;
  icon: React.ReactNode;
  colorClass: "green" | "blue" | "orange" | "purple";
  delay?: number;
}

const colorConfig = {
  green: {
    bg: "var(--kpi-green-bg)",
    border: "oklch(0.88 0.06 165 / 0.4)",
    iconBg: "#D1F5E8",
    iconColor: "#22A86B",
    accentColor: "#34C78A",
  },
  blue: {
    bg: "var(--kpi-blue-bg)",
    border: "oklch(0.85 0.06 265 / 0.4)",
    iconBg: "#DDE8FF",
    iconColor: "#4C6EF5",
    accentColor: "#6C8EF5",
  },
  orange: {
    bg: "var(--kpi-orange-bg)",
    border: "oklch(0.88 0.07 55 / 0.4)",
    iconBg: "#FFE8D8",
    iconColor: "#E8722A",
    accentColor: "#F5956C",
  },
  purple: {
    bg: "var(--kpi-purple-bg)",
    border: "oklch(0.85 0.06 295 / 0.4)",
    iconBg: "#EAE0FF",
    iconColor: "#7C5CF5",
    accentColor: "#A78BFA",
  },
};

function useCountUp(target: number, duration = 1000, delay = 0) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      const startTime = Date.now();
      const step = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(target * eased * 10) / 10);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);

  return count;
}

export default function KPICard({
  title,
  value,
  numericValue,
  prefix = "",
  suffix = "",
  trend,
  trendLabel,
  icon,
  colorClass,
  delay = 0,
}: KPICardProps) {
  const colors = colorConfig[colorClass];
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      className="rounded-2xl p-5 card-enter"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
        animationDelay: `${delay}ms`,
        opacity: 0,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-700 text-slate-500 uppercase tracking-wider mb-1" style={{ fontWeight: 700 }}>
            {title}
          </p>
          <p
            className="text-2xl font-900 text-slate-800 leading-none"
            style={{ fontWeight: 900, fontFamily: "'Nunito', sans-serif" }}
          >
            {prefix}
            {value}
            {suffix}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: colors.iconBg }}
        >
          <span style={{ color: colors.iconColor }}>{icon}</span>
        </div>
      </div>


      <div className="flex items-center gap-1.5">
        {trend !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-700"
            style={{
              background: isPositive ? "#D1FAE5" : "#FEE2E2",
              color: isPositive ? "#059669" : "#DC2626",
              fontWeight: 700,
            }}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend && Math.abs(trend)}%
          </div>
        )}
        {trendLabel && (
          <Badge variant="outline" >

            <span className="text-xs text-slate-800">{trendLabel}</span>
          </Badge>
        )}
      </div>

    </div>
  );
}
