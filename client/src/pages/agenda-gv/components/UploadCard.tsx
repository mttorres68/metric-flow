import { CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AtividadeParsed } from "../lib/parser";
import { fileToBase64, formatDue } from "../lib/parser";

interface UploadCardProps {
  revenda: string;
  boardId: string;
  atividades: AtividadeParsed[] | null;
  status: "aguardando" | "carregando" | "carregado" | "erro";
  erro?: string;
  onCarregado: (atividades: AtividadeParsed[]) => void;
  onLimpar: () => void;
}

export function UploadCard({ revenda, boardId, atividades, status, erro, onCarregado, onLimpar }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandido, setExpandido] = useState(false);

  async function processFile(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Selecione um arquivo .xlsx ou .xls");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/crm/parse-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxBase64: base64 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao processar arquivo");
      }
      const data = await res.json();
      onCarregado(data.atividades);
    } catch (e: any) {
      alert("Erro ao carregar planilha: " + e.message);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  const isCarregado = status === "carregado" && atividades && atividades.length > 0;
  const isCarregando = status === "carregando";

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
      isCarregado
        ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--card)]"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C8EF5 0%, #A78BFA 100%)" }}
          >
            {revenda.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{revenda}</p>
            {isCarregado && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {atividades.length} atividades carregadas
              </p>
            )}
            {status === "aguardando" && (
              <p className="text-xs text-slate-400 dark:text-slate-500">Aguardando planilha</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCarregado && (
            <>
              <button
                onClick={() => setExpandido((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
              >
                {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Ver atividades
              </button>
              <button
                onClick={onLimpar}
                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                title="Remover planilha"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {isCarregado && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
        </div>
      </div>

      {/* Área de upload (só quando não carregado) */}
      {!isCarregado && (
        <div className="px-4 pb-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            {isCarregando ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto mb-1" />
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                  <FileSpreadsheet className="w-5 h-5" />
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Arraste a planilha ou <span className="text-indigo-500 font-medium">clique para selecionar</span>
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">agenda_gv_XX.xlsx</p>
              </div>
            )}
          </div>
          {erro && <p className="text-xs text-red-500 mt-1.5">{erro}</p>}
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* Preview das atividades (colapsável) */}
      {isCarregado && expandido && (
        <div className="border-t border-green-200 dark:border-green-800/50 max-h-52 overflow-y-auto">
          {atividades!.map((a) => (
            <div key={a.codigo} className="flex items-center gap-2 px-4 py-2 border-b border-green-100 dark:border-green-900/30 last:border-0">
              <span className="text-[10px] font-mono font-semibold text-indigo-500 w-8 flex-shrink-0">{a.codigo}</span>
              <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{a.nome}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatDue(a.due)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
