import React, { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar buttons
// ─────────────────────────────────────────────────────────────────────────────

const TOOLBAR_BTNS = [
    { cmd: "bold", arg: null, label: "N", title: "Negrito", style: { fontWeight: 900 } },
    { cmd: "italic", arg: null, label: "I", title: "Itálico", style: { fontStyle: "italic" } },
    { cmd: "underline", arg: null, label: "S", title: "Sublinhado", style: { textDecoration: "underline" } },
    { cmd: "hiliteColor", arg: "#fde047", label: "▌", title: "Destacar", style: { color: "#ca8a04" } },
    { cmd: "formatBlock", arg: "H2", label: "H", title: "Título", style: { fontWeight: 800, fontSize: 13 } },
    { cmd: "insertUnorderedList", arg: null, label: "•", title: "Lista", style: {} },
    { cmd: "insertOrderedList", arg: null, label: "1.", title: "Lista numerada", style: {} },
    { cmd: "removeFormat", arg: null, label: "✕", title: "Limpar formatação", style: { color: "#94a3b8" } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorAnaliseProps {
    /** Identificador único para o placeholder e acessibilidade */
    id: string;
    /** HTML inicial do editor (controlado externamente via estado/localStorage) */
    html: string;
    /** Callback chamado quando o conteúdo muda (debounced 350ms) */
    onChange: (html: string) => void;
    /** Texto exibido quando o editor está vazio */
    placeholder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function EditorAnalise({ id, html, onChange, placeholder }: EditorAnaliseProps) {
    const ref = useRef<HTMLDivElement>(null);
    const debRef = useRef<any>(null);
    const mountedRef = useRef(false);
    const [focado, setFocado] = useState(false);

    const defaultPlaceholder = placeholder ?? `Registre aqui a análise — o que aconteceu, pontos de atenção, planos de ação...`;

    // Popula conteúdo inicial sem mexer no cursor
    useEffect(() => {
        if (ref.current && !mountedRef.current) {
            ref.current.innerHTML = html || "";
            mountedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const salvar = useCallback(() => {
        clearTimeout(debRef.current);
        debRef.current = setTimeout(() => onChange(ref.current?.innerHTML || ""), 350);
    }, [onChange]);

    const cmd = useCallback((command: string, arg?: string | null) => {
        document.execCommand(command, false, arg ?? undefined);
        ref.current?.focus();
        salvar();
    }, [salvar]);

    useEffect(() => () => clearTimeout(debRef.current), []);

    return (
        <div
            className={`rounded-xl overflow-hidden border transition-all ${focado
                ? "border-indigo-400 shadow-sm shadow-indigo-100"
                : "border-slate-200"
                }`}
            style={{ background: "#fff" }}
        >
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex-wrap">
                {TOOLBAR_BTNS.map((b, i) => (
                    <React.Fragment key={b.cmd + i}>
                        {(i === 3 || i === 4 || i === 5 || i === 7) && (
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                        )}
                        <button
                            title={b.title}
                            onMouseDown={e => { e.preventDefault(); cmd(b.cmd, b.arg); }}
                            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-white hover:text-slate-800 transition-all"
                            style={b.style}
                        >
                            {b.label}
                        </button>
                    </React.Fragment>
                ))}
                <span className="ml-auto text-xs text-slate-400 italic" style={{ fontSize: 9 }}>💾 auto</span>
            </div>

            {/* Editor area */}
            <div
                ref={ref}
                id={id}
                contentEditable
                suppressContentEditableWarning
                onInput={salvar}
                onFocus={() => setFocado(true)}
                onBlur={() => setFocado(false)}
                data-placeholder={defaultPlaceholder}
                className="outline-none px-4 py-3 text-sm text-slate-700 min-h-[80px]"
                style={{ lineHeight: 1.7, caretColor: "#4f46e5", wordBreak: "break-word" }}
            />

            {/* Editor styles */}
            <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #cbd5e1;
          font-style: italic;
          pointer-events: none;
        }
        [contenteditable] h2 { font-size: 14px; font-weight: 700; color: #3730a3; margin: 6px 0 3px; }
        [contenteditable] ul { padding-left: 18px; margin: 3px 0; list-style: disc; }
        [contenteditable] ol { padding-left: 18px; margin: 3px 0; list-style: decimal; }
        [contenteditable] li { margin: 2px 0; }
        [contenteditable] strong, [contenteditable] b { color: #1e293b; }
        [contenteditable] mark { background: #fde047; padding: 0 2px; border-radius: 2px; }
        [contenteditable] u { text-decoration-color: #4f46e5; }
      `}</style>
        </div>
    );
}

export default EditorAnalise;
