/**
 * Shared motion primitives for Design polish Phase 1.
 *
 * These constants exist so every surface uses the same spring feel and the
 * same reduced-motion fallback. Do not inline spring values in components —
 * if a surface needs a different feel, add a named variant here.
 *
 * Conventions (see decisions.md — Design direction):
 *   - bounce: 0 everywhere. Dialogs, menus, and informational surfaces never
 *     overshoot. Bounce is reserved for drag-release and explicit success
 *     celebrations, which this file does not cover.
 *   - Enter is slower than exit. Users feel the entrance; the exit just
 *     needs to not feel abrupt.
 *   - Reduced motion is a 120ms opacity cross-fade with no transform.
 */

export const SPRING_ENTER = { type: 'spring', bounce: 0, duration: 0.3 } as const;
export const SPRING_EXIT = { type: 'spring', bounce: 0, duration: 0.2 } as const;

export const FADE_ENTER = { duration: 0.12, ease: 'easeOut' } as const;
export const FADE_EXIT = { duration: 0.12, ease: 'easeIn' } as const;

/** Backdrop fade — always opacity-only, in both normal and reduced-motion modes. */
export const BACKDROP_ENTER = { duration: 0.15, ease: 'easeOut' } as const;
export const BACKDROP_EXIT = { duration: 0.15, ease: 'easeIn' } as const;

/**
 * Modal card offset, in pixels. An 8px upward slide reads as "arrived"
 * without the per-frame resampling cost of a scale transform —
 * software-rendered sessions (hardware acceleration OFF) stay smooth.
 * See decisions.md — Design direction.
 */
export const MODAL_OFFSET_Y = 8;