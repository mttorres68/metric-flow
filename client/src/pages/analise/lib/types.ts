import { ALL_COLS } from "./constants";

export type ColId = typeof ALL_COLS[number]["id"];
export type AcaoTipo = "deslocamento" | "problema";
export type AcaoVendState = { deslocamento: boolean; problema: boolean };
export type RevStatus = "idle" | "generating" | "sending" | "done" | "error" | "skipped";

export interface RevState {
    rev: string;
    dests: string[];
    destIds: string[];
    selectedDestIds: Set<string>;
    checked: boolean;
    status: RevStatus;
    detail: string;
}
