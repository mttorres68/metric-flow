import { useState, useEffect } from "react";

const EVENT_NAME = "sidebar-collapse-toggle";

export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleToggle = (e: any) => setIsCollapsed(e.detail);
    window.addEventListener(EVENT_NAME, handleToggle);
    return () => window.removeEventListener(EVENT_NAME, handleToggle);
  }, []);

  const toggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  };

  return { isCollapsed, toggle };
}
