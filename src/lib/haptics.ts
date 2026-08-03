export function hapticTap(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Optional feedback only.
  }
}
