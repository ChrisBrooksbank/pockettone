export function useHaptics(enabled: boolean) {
  return (pattern: number | number[]) => {
    if (!enabled || !("vibrate" in navigator)) {
      return;
    }

    navigator.vibrate(pattern);
  };
}
