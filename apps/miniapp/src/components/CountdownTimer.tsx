import { useEffect, useMemo, useState } from 'react';

interface CountdownTimerProps {
  targetIso: string;
}

const compute = (targetIso: string) => {
  const ms = new Date(targetIso).getTime() - Date.now();
  const total = Math.max(0, ms);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { total, days, hours, minutes, seconds };
};

export const CountdownTimer = ({ targetIso }: CountdownTimerProps) => {
  const [state, setState] = useState(() => compute(targetIso));

  useEffect(() => {
    const interval = window.setInterval(() => setState(compute(targetIso)), 1000);
    return () => window.clearInterval(interval);
  }, [targetIso]);

  const text = useMemo(
    () => `${state.days}d ${state.hours}h ${state.minutes}m ${state.seconds}s`,
    [state.days, state.hours, state.minutes, state.seconds],
  );

  return <span>{state.total === 0 ? 'Ended' : text}</span>;
};
