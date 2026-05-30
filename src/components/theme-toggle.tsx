"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "./icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("aqoj-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Changer de thème"
      className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {dark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
