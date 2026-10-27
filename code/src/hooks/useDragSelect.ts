import { useEffect, useRef, type RefObject } from 'react';

interface UseDragSelectOptions {
    /** The container that wraps the cards. Used to scope hit-testing and find the scroll parent. */
    containerRef: RefObject<HTMLElement | null>;
    /** When true, a plain click toggles; when false, a long-press arms selection mode. */
    enabled: boolean;
    /** Called when a card needs to be toggled in/out of the selection. */
    onToggle: (id: string) => void;
    /** Called when a long-press arms the selection mode. Parent should flip `enabled` to true. */
    onEnterSelectionMode?: (id: string) => void;
    /** Reads the current auto-scroll speed preference (2–20). Called each frame. */
    getAutoScrollSpeed: () => number;
    /** Attribute on card elements that carries their id. Default: `data-card-id`. */
    cardAttribute?: string;
    longPressMs?: number;
    moveToleranceSq?: number;
    edgeZoneFraction?: number;
    edgeZoneMinPx?: number;
}

const DEFAULTS = {
    cardAttribute: 'data-card-id',
    longPressMs: 400,
    moveToleranceSq: 25,
    edgeZoneFraction: 0.18,
    edgeZoneMinPx: 60,
} as const;

const WARMUP_MS = 900;

/**
 * Find the nearest ancestor of `el` that actually scrolls vertically.
 * Skips the container itself — that's the point: we want the scroll
 * container, not the container we pass in.
 */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
        const oy = window.getComputedStyle(node).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * Long-press + continuous drag-select engine.
 *
 * Two modes:
 *  - When `enabled` is false: a 400ms long-press on a card calls
 *    `onEnterSelectionMode(id)`. The same press then continues as the
 *    start of a drag-select gesture — the parent doesn't need to
 *    re-dispatch anything.
 *  - When `enabled` is true: a plain pointerdown on a card immediately
 *    begins a drag-select. A stationary click toggles; a drag across
 *    cards toggles each new one.
 *
 * Hit-testing runs on the global rAF loop, so cards scrolling *under* a
 * stationary cursor get picked up (matches iPhone Photos behaviour).
 *
 * The caller is responsible for Escape-to-exit and for the visual
 * checkbox state — this hook only owns the pointer engine.
 */
export function useDragSelect({
    containerRef,
    enabled,
    onToggle,
    onEnterSelectionMode,
    getAutoScrollSpeed,
    cardAttribute = DEFAULTS.cardAttribute,
    longPressMs = DEFAULTS.longPressMs,
    moveToleranceSq = DEFAULTS.moveToleranceSq,
    edgeZoneFraction = DEFAULTS.edgeZoneFraction,
    edgeZoneMinPx = DEFAULTS.edgeZoneMinPx,
}: UseDragSelectOptions) {
    // Mirror props into refs so the pointer listeners don't need to re-bind
    // on every render — rebinding mid-gesture would kill an active drag.
    const enabledRef = useRef(enabled);
    useEffect(() => { enabledRef.current = enabled; }, [enabled]);

    const onToggleRef = useRef(onToggle);
    useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

    const enterRef = useRef(onEnterSelectionMode);
    useEffect(() => { enterRef.current = onEnterSelectionMode; }, [onEnterSelectionMode]);

    const speedRef = useRef(getAutoScrollSpeed);
    useEffect(() => { speedRef.current = getAutoScrollSpeed; }, [getAutoScrollSpeed]);

    const dragActiveRef = useRef(false);
    const lastHoveredIdRef = useRef<string | null>(null);
    const pointerRef = useRef({ x: 0, y: 0 });
    const autoScrollDirRef = useRef(0);
    const autoScrollStartRef = useRef(0);
    const autoScrollRafRef = useRef<number | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressStartRef = useRef<{ x: number; y: number; id: string } | null>(null);

    useEffect(() => {
        const selector = `[${cardAttribute}]`;

        const stopRaf = () => {
            if (autoScrollRafRef.current !== null) {
                cancelAnimationFrame(autoScrollRafRef.current);
                autoScrollRafRef.current = null;
            }
        };

        const cancelLongPress = () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        };

        const hitTest = () => {
            const { x, y } = pointerRef.current;
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            const cardEl = el?.closest(selector) as HTMLElement | null;
            const id = cardEl?.getAttribute(cardAttribute) ?? null;
            if (id && id !== lastHoveredIdRef.current) {
                lastHoveredIdRef.current = id;
                onToggleRef.current(id);
            } else if (!id) {
                lastHoveredIdRef.current = null;
            }
        };

        const tick = () => {
            if (!dragActiveRef.current) {
                autoScrollRafRef.current = null;
                return;
            }

            const parent = findScrollParent(containerRef.current);
            if (parent) {
                const rect = parent.getBoundingClientRect();
                const { y } = pointerRef.current;
                const zone = Math.max(edgeZoneMinPx, rect.height * edgeZoneFraction);

                let dir = 0;
                let depth = 0;
                if (y < rect.top + zone) {
                    dir = -1;
                    depth = Math.min(1, (rect.top + zone - y) / zone);
                } else if (y > rect.bottom - zone) {
                    dir = 1;
                    depth = Math.min(1, (y - (rect.bottom - zone)) / zone);
                }

                if (dir !== 0) {
                    if (autoScrollDirRef.current === 0) autoScrollStartRef.current = Date.now();
                    autoScrollDirRef.current = dir;
                    const elapsed = Date.now() - autoScrollStartRef.current;
                    const warm = Math.min(1, 0.4 + (elapsed / WARMUP_MS) * 0.6);
                    const speed = speedRef.current();
                    const base = speed * (0.3 + depth * 0.7);
                    parent.scrollTop += dir * Math.max(0.4, base * warm);
                } else {
                    autoScrollDirRef.current = 0;
                }
            }

            hitTest();
            autoScrollRafRef.current = requestAnimationFrame(tick);
        };

        const startRaf = () => {
            if (autoScrollRafRef.current === null) {
                autoScrollRafRef.current = requestAnimationFrame(tick);
            }
        };

        const beginDrag = (x: number, y: number, id: string) => {
            dragActiveRef.current = true;
            lastHoveredIdRef.current = id;
            pointerRef.current.x = x;
            pointerRef.current.y = y;
            onToggleRef.current(id);
            startRaf();
        };

        const endDrag = () => {
            dragActiveRef.current = false;
            lastHoveredIdRef.current = null;
            autoScrollDirRef.current = 0;
            stopRaf();
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            // Never intercept interactive elements. If the user is clicking
            // a button (Run, menu, etc.) we let the click through — the
            // card's selection overlay (rendered by the caller in selection
            // mode) is a plain <div> and won't match this filter, so
            // selection clicks still work.
            if (target.closest('input, textarea, select, button, [data-drag-handle]')) return;
            if (!containerRef.current?.contains(target)) return;

            const cardEl = target.closest(selector) as HTMLElement | null;
            const id = cardEl?.getAttribute(cardAttribute);
            if (!id) return;

            if (enabledRef.current) {
                e.preventDefault();
                beginDrag(e.clientX, e.clientY, id);
                return;
            }

            if (!enterRef.current) return;

            // Arm long-press. Note: we do NOT preselect in the parent —
            // beginDrag will toggle the initial id, which is what enters
            // selection with one card selected. Preselecting in the parent
            // AND toggling here would double-fire and leave the selection
            // empty (this is the bug that exists in ActionSequence today).
            cancelLongPress();
            longPressStartRef.current = { x: e.clientX, y: e.clientY, id };
            longPressTimerRef.current = setTimeout(() => {
                longPressTimerRef.current = null;
                const start = longPressStartRef.current;
                longPressStartRef.current = null;
                if (!start) return;
                enterRef.current?.(start.id);
                // Continue as a drag from the same press. Parent flips
                // `enabled` on next render, but we want the gesture to
                // keep going immediately.
                beginDrag(pointerRef.current.x, pointerRef.current.y, start.id);
            }, longPressMs);
        };

        const onPointerMove = (e: PointerEvent) => {
            pointerRef.current.x = e.clientX;
            pointerRef.current.y = e.clientY;

            if (longPressTimerRef.current && longPressStartRef.current) {
                const dx = e.clientX - longPressStartRef.current.x;
                const dy = e.clientY - longPressStartRef.current.y;
                if (dx * dx + dy * dy > moveToleranceSq) {
                    cancelLongPress();
                    longPressStartRef.current = null;
                }
            }

            // Catch the case where the primary button is released without
            // a pointerup (happens when the cursor leaves the window).
            if (dragActiveRef.current && (e.buttons & 1) === 0) {
                endDrag();
            }
        };

        const onPointerUp = () => {
            cancelLongPress();
            longPressStartRef.current = null;
            endDrag();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);
        window.addEventListener('blur', onPointerUp);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerUp, true);
            window.removeEventListener('blur', onPointerUp);
            stopRaf();
            cancelLongPress();
        };
    }, [containerRef, cardAttribute, longPressMs, moveToleranceSq, edgeZoneFraction, edgeZoneMinPx]);
}