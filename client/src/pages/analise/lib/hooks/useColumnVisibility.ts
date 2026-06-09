import { useState } from "react";
import { ALL_COLS, COLS_KEY } from "../constants";
import type { ColId } from "../types";

export function useColumnVisibility() {
    const [visible, setVisible] = useState<Record<ColId, boolean>>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
            if (stored) return stored;
        } catch { /* ignore */ }
        return Object.fromEntries(ALL_COLS.map(c => [c.id, true])) as Record<ColId, boolean>;
    });

    const toggle = (id: ColId) => setVisible(prev => {
        const next = { ...prev, [id]: !prev[id] };
        localStorage.setItem(COLS_KEY, JSON.stringify(next));
        return next;
    });

    const col = (id: ColId) => visible[id] ?? true;

    const allOn = ALL_COLS.every(c => visible[c.id]);
    const toggleAll = () => {
        const next = Object.fromEntries(ALL_COLS.map(c => [c.id, !allOn])) as Record<ColId, boolean>;
        setVisible(next);
        localStorage.setItem(COLS_KEY, JSON.stringify(next));
    };

    const hiddenCount = ALL_COLS.filter(c => !visible[c.id]).length;

    return { col, toggle, toggleAll, allOn, hiddenCount };
}
