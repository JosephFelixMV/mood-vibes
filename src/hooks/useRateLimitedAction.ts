import { useState, useCallback, useRef } from "react";

/**
 * Rate-limits a callback. Returns the wrapped action and a `cooldown` flag.
 * @param cooldownMs - minimum ms between invocations (default 2000)
 */
export function useRateLimitedAction(cooldownMs = 2000) {
  const [cooldown, setCooldown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(
    (action: () => void) => {
      if (cooldown) return;
      action();
      setCooldown(true);
      timerRef.current = setTimeout(() => setCooldown(false), cooldownMs);
    },
    [cooldown, cooldownMs],
  );

  return { trigger, cooldown };
}
