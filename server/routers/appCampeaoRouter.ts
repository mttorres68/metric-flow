import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const CACHE_TTL_MS = 5 * 60 * 1000;

// Cache por chave "action_dataInicio_dataFim"
const cacheMap = new Map<string, { data: any[]; ts: number }>();

export interface AppCampeaoRow {
    _grupo: "Duttra" | "Forte";
    _regional: "R1" | "R2";
    [key: string]: string | number;
}

export interface AgendaGARow {
    [key: string]: string | number;
}

function appsScriptUrl(): string {
    const url = process.env.APPS_SCRIPT_URL;
    if (!url) throw new Error("APPS_SCRIPT_URL não configurado no .env");
    return url;
}

function todayFortaleza(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Fortaleza",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

const dateInput = z.object({
    dateStart: z.string().optional(),
    dateEnd:   z.string().optional(),
});

async function fetchAction<T>(action: string, dateStart: string, dateEnd: string): Promise<T[]> {
    const key = `${action}_${dateStart}_${dateEnd}`;
    const cached = cacheMap.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data as T[];

    const params = new URLSearchParams({ action, dataInicio: dateStart, dataFim: dateEnd });
    const url = `${appsScriptUrl()}?${params.toString()}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);

    const json = await res.json() as { ok: boolean; data?: T[]; error?: string };
    if (!json.ok) throw new Error(json.error ?? "Erro no Apps Script");

    const data = json.data ?? [];
    cacheMap.set(key, { data, ts: Date.now() });
    return data;
}

export const appCampeaoRouter = router({

    getAll: publicProcedure.input(dateInput).query(async ({ input }): Promise<AppCampeaoRow[]> => {
        const today = todayFortaleza();
        const dateStart = input.dateStart ?? today;
        const dateEnd   = input.dateEnd   ?? dateStart;
        return fetchAction<AppCampeaoRow>("appCampeao", dateStart, dateEnd);
    }),

    getAgendaGA: publicProcedure.input(dateInput).query(async ({ input }): Promise<AgendaGARow[]> => {
        const today = todayFortaleza();
        const dateStart = input.dateStart ?? today;
        const dateEnd   = input.dateEnd   ?? dateStart;
        return fetchAction<AgendaGARow>("agendaGA", dateStart, dateEnd);
    }),

    invalidateCache: publicProcedure.mutation(() => {
        cacheMap.clear();
        return { ok: true };
    }),
});
