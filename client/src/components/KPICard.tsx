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

// Todas as cores via CSS variables — adaptam-se automaticamente ao dark mode
const colorConfig = {
  green: {
    cardClass: "kpi-card-green",
    iconBg: "var(--kpi-green-icon-bg)",
    iconColor: "var(--kpi-green-icon-color)",
    accentColor: "var(--kpi-green-accent)",
    textColor: "var(--kpi-green-text)",
  },
  blue: {
    cardClass: "kpi-card-blue",
    iconBg: "var(--kpi-blue-icon-bg)",
    iconColor: "var(--kpi-blue-icon-color)",
    accentColor: "var(--kpi-blue-accent)",
    textColor: "var(--kpi-blue-text)",
  },
  orange: {
    cardClass: "kpi-card-orange",
    iconBg: "var(--kpi-orange-icon-bg)",
    iconColor: "var(--kpi-orange-icon-color)",
    accentColor: "var(--kpi-orange-accent)",
    textColor: "var(--kpi-orange-text)",
  },
  purple: {
    cardClass: "kpi-card-purple",
    iconBg: "var(--kpi-purple-icon-bg)",
    iconColor: "var(--kpi-purple-icon-color)",
    accentColor: "var(--kpi-purple-accent)",
    textColor: "var(--kpi-purple-text)",
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
      className={`rounded-2xl p-5 card-enter ${colors.cardClass}`}
      style={{
        animationDelay: `${delay}ms`,
        opacity: 0,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p
            className="text-xs uppercase tracking-wider mb-1"
            style={{ fontWeight: 700, color: "var(--muted-foreground)" }}
          >
            {title}
          </p>
          <p
            className="text-2xl leading-none"
            style={{
              fontWeight: 900,
              fontFamily: "'Nunito', sans-serif",
              color: "var(--foreground)",
            }}
          >
            {prefix}{value}{suffix}
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
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{
              background: isPositive
                ? "var(--status-ok-bg)"
                : "var(--status-nok-bg)",
              color: isPositive
                ? "var(--status-ok-text)"
                : "var(--status-nok-text)",
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
          <Badge variant="outline">
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {trendLabel}
            </span>
          </Badge>
        )}
      </div>
    </div>
  );
}
