import { REVENDA_ALIASES } from "./constants";

export function canonicalRevenda(name: string): string {
    return REVENDA_ALIASES[name.toLowerCase().trim()] ?? name;
}

export function revendasMatch(stored: string, query: string): boolean {
    return canonicalRevenda(stored).toLowerCase() === canonicalRevenda(query).toLowerCase();
}
