export function KpiCard({ titulo, valor, icone: Icone, cor, subtitulo }: {
    titulo: string;
    valor: number | string;
    icone: any;
    cor: string;
    subtitulo?: string;
}) {
    return (
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl p-5 relative overflow-hidden"
            style={{
                border: "1px solid oklch(0.93 0.006 240)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${cor} opacity-20`} />
            <div className="relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cor} flex items-center justify-center mb-3`}>
                    <Icone className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider" style={{ fontWeight: 700 }}>
                    {titulo}
                </p>
                <p className="text-3xl text-slate-800 dark:text-slate-100 mt-1 tabular-nums" style={{ fontWeight: 900 }}>
                    {valor}
                </p>
                {subtitulo && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1" style={{ fontWeight: 500 }}>
                        {subtitulo}
                    </p>
                )}
            </div>
        </div>
    );
}
