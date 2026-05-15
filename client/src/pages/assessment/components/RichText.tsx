import type { ReactNode } from "react";

type LineType = "question" | "numbered" | "lettered" | "obs" | "url" | "blank" | "text";

function classifyLine(line: string): LineType {
    const t = line.trim();
    if (!t) return "blank";
    if (/^https?:\/\//i.test(t)) return "url";
    if (/^obs\.?:/i.test(t) || /^obs\./i.test(t)) return "obs";
    if (/^\d+\.\s/.test(t)) return "numbered";
    if (/^[a-zA-Z]\.\s/.test(t)) return "lettered";
    if (t.endsWith("?")) return "question";
    return "text";
}

export function RichText({ texto }: { texto: string }) {
    const lines = texto.replace(/\r/g, "").split("\n");
    const nodes: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const kind = classifyLine(line);

        if (kind === "blank") { i++; continue; }

        if (kind === "question") {
            nodes.push(
                <p key={i} className="text-xs text-indigo-600 dark:text-indigo-400 mb-2" style={{ fontWeight: 700, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        } else if (kind === "numbered") {
            const match = line.trim().match(/^(\d+)\.\s(.*)$/);
            if (match) {
                nodes.push(
                    <div key={i} className="flex gap-2 mt-2 mb-0.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]" style={{ fontWeight: 800 }}>
                            {match[1]}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-200 pt-0.5" style={{ fontWeight: 600, lineHeight: 1.6 }}>
                            {match[2]}
                        </span>
                    </div>
                );
            }
        } else if (kind === "lettered") {
            const match = line.trim().match(/^([a-zA-Z])\.\s(.*)$/);
            if (match) {
                nodes.push(
                    <div key={i} className="flex gap-2 ml-7 mt-0.5">
                        <span className="flex-shrink-0 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5 w-4" style={{ fontWeight: 700 }}>
                            {match[1]}.
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                            {match[2]}
                        </span>
                    </div>
                );
            }
        } else if (kind === "obs") {
            nodes.push(
                <div key={i} className="flex gap-2 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg">
                    <span className="text-xs text-amber-600 dark:text-amber-400" style={{ fontWeight: 700, lineHeight: 1.6 }}>
                        {line.trim()}
                    </span>
                </div>
            );
        } else if (kind === "url") {
            nodes.push(
                <p key={i} className="text-xs text-slate-400 dark:text-slate-500 ml-7 truncate" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        } else {
            nodes.push(
                <p key={i} className="text-xs text-slate-600 dark:text-slate-300 mt-1" style={{ fontWeight: 500, lineHeight: 1.6 }}>
                    {line.trim()}
                </p>
            );
        }
        i++;
    }

    return <div className="space-y-0.5">{nodes}</div>;
}

export function DetailBlock({ titulo, texto }: { titulo: string; texto?: string | null }) {
    if (!texto) return null;
    return (
        <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2" style={{ fontWeight: 700 }}>
                {titulo}
            </p>
            <RichText texto={texto} />
        </div>
    );
}
