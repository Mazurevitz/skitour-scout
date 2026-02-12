/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback for touch interactions on supported devices.
 * Falls back gracefully on unsupported devices.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback if supported
 */
export function haptic(style: HapticStyle = 'light'): void {
  // Check for Vibration API support
  if (!('vibrate' in navigator)) {
    return;
  }

  // Different vibration patterns for different styles
  const patterns: Record<HapticStyle, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 30, 20],
    error: [30, 50, 30, 50, 30],
  };

  try {
    navigator.vibrate(patterns[style]);
  } catch {
    // Silently fail if vibration not allowed
  }
}

/**
 * Trigger haptic on button press
 */
export function hapticButton(): void {
  haptic('light');
}

/**
 * Trigger haptic on successful action
 */
export function hapticSuccess(): void {
  haptic('success');
}

/**
 * Trigger haptic on error/warning
 */
export function hapticError(): void {
  haptic('error');
}

/**
 * Trigger haptic on swipe/drag gesture
 */
export function hapticGesture(): void {
  haptic('medium');
}
