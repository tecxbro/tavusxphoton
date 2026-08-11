/**
 * Brief haptic pulse for control taps. No-ops when Vibration API is missing.
 */
export function hapticTap(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Optional feedback only.
  }
}
