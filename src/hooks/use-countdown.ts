"use client";

import { useEffect, useState } from "react";

/** Renvoie le temps restant (ms) jusqu'à `deadline`, rafraîchi en continu. */
export function useCountdown(deadline: number | null | undefined): number {
  const [msLeft, setMsLeft] = useState(() =>
    deadline ? Math.max(0, deadline - Date.now()) : 0,
  );

  useEffect(() => {
    if (!deadline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMsLeft(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setMsLeft(Math.max(0, deadline - Date.now()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline]);

  return msLeft;
}
