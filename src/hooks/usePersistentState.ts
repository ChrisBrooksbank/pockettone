import { useEffect, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T, restore: (stored: unknown) => T = (stored) => stored as T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? restore(JSON.parse(stored)) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
