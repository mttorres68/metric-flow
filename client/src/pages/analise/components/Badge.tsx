import React from "react";

const BADGE_STYLES: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50",
    red: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50",
    blue: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50",
    slate: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600/50",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700/50",
};

export function Badge({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${BADGE_STYLES[color] ?? BADGE_STYLES.slate}`}>
            {children}
        </span>
    );
}
