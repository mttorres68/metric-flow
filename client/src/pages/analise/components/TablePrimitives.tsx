import React from "react";

export function Th({ children, title, center }: { children: React.ReactNode; title?: string; center?: boolean }) {
    return (
        <th
            title={title}
            className={`px-2 py-2.5 text-xs font-bold text-slate-100 uppercase tracking-wider whitespace-nowrap border-b border-slate-100 ${center ? "text-center" : "text-left"} cursor-help`}
        >
            {children}
        </th>
    );
}

export function Td({ children, center, mono, className = "" }: {
    children: React.ReactNode;
    center?: boolean;
    mono?: boolean;
    className?: string;
}) {
    return (
        <td className={`px-2 py-2 text-xs border-b border-slate-100 dark:border-slate-700/40 ${center ? "text-center" : ""} ${mono ? "font-mono" : ""} ${className}`}>
            {children}
        </td>
    );
}
