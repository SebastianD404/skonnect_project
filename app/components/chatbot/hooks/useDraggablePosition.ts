"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Position = { x: number; y: number };

type Options = {
  storageKey: string;
  buttonSize: number;
  viewportMargin: number;
  topBoundary: number;
};

const SNAP_THRESHOLD = 28;

function getDefaultPosition(buttonSize: number, viewportMargin: number, topBoundary: number): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  const x = window.innerWidth - buttonSize - viewportMargin;
  const bottomOffset = Math.max(64, viewportMargin * 2);
  const y = clamp(window.innerHeight - buttonSize - bottomOffset, topBoundary, window.innerHeight - buttonSize - viewportMargin);
  return { x, y };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampToViewport(params: {
  position: Position;
  buttonSize: number;
  viewportMargin: number;
  topBoundary: number;
}) {
  const { position, buttonSize, viewportMargin, topBoundary } = params;

  if (typeof window === "undefined") {
    return position;
  }

  const minX = viewportMargin;
  const maxX = window.innerWidth - buttonSize - viewportMargin;
  const minY = topBoundary;
  const maxY = window.innerHeight - buttonSize - viewportMargin;

  return {
    x: clamp(position.x, minX, Math.max(minX, maxX)),
    y: clamp(position.y, minY, Math.max(minY, maxY)),
  };
}

function snapToViewportBoundary(params: {
  position: Position;
  buttonSize: number;
  viewportMargin: number;
  topBoundary: number;
}) {
  const { position, buttonSize, viewportMargin, topBoundary } = params;

  if (typeof window === "undefined") {
    return position;
  }

  const minX = viewportMargin;
  const maxX = Math.max(minX, window.innerWidth - buttonSize - viewportMargin);
  const minY = topBoundary;
  const maxY = Math.max(minY, window.innerHeight - buttonSize - viewportMargin);

  const clamped = clampToViewport({
    position,
    buttonSize,
    viewportMargin,
    topBoundary,
  });

  const distLeft = Math.abs(clamped.x - minX);
  const distRight = Math.abs(maxX - clamped.x);
  const distTop = Math.abs(clamped.y - minY);
  const distBottom = Math.abs(maxY - clamped.y);

  const snapX = Math.min(distLeft, distRight) <= SNAP_THRESHOLD;
  const snapY = Math.min(distTop, distBottom) <= SNAP_THRESHOLD;

  return {
    x: snapX ? (distLeft <= distRight ? minX : maxX) : clamped.x,
    y: snapY ? (distTop <= distBottom ? minY : maxY) : clamped.y,
  };
}

function positionsAreEqual(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

function getHydratedPosition(params: {
  storageKey: string;
  buttonSize: number;
  viewportMargin: number;
  topBoundary: number;
}) {
  const { storageKey, buttonSize, viewportMargin, topBoundary } = params;

  if (typeof window === "undefined") {
    return {
      position: { x: 0, y: 0 },
      isDefaultPosition: true,
    };
  }

  const fallback = clampToViewport({
    position: getDefaultPosition(buttonSize, viewportMargin, topBoundary),
    buttonSize,
    viewportMargin,
    topBoundary,
  });

  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) {
    return { position: fallback, isDefaultPosition: true };
  }

  try {
    // Support legacy storage format (Position) and new format ({ x, y, moved })
    const parsedRaw = JSON.parse(raw) as any;
    const parsed = typeof parsedRaw === "object" && parsedRaw !== null ? parsedRaw : null;
    const parsedPos = parsed && typeof parsed.x === "number" && typeof parsed.y === "number" ? { x: parsed.x, y: parsed.y } : null;
    const parsedMoved = parsed && parsed.moved === true;
    if (!parsedPos) {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {}
      return { position: fallback, isDefaultPosition: true };
    }

    // guard against NaN/Infinity stored values
    if (Number.isFinite(parsedPos.x) && Number.isFinite(parsedPos.y)) {
      const clamped = clampToViewport({
        position: parsedPos,
        buttonSize,
        viewportMargin,
        topBoundary,
      });

      // If the stored position is on the left half of the screen (user likely dragged accidentally),
      // reset to default so the widget stays in the lower-right by default.
      try {
        const half = window.innerWidth / 2;
        if (clamped.x < half) {
          // clear bad saved position and fallback
          try {
            window.sessionStorage.removeItem(storageKey);
          } catch {}
          return { position: fallback, isDefaultPosition: true };
        }
      } catch {}

      // If the stored position is unexpectedly near the top-left corner,
      // treat it as unset and fall back to the default lower-right position.
      const nearTopLeftThreshold = 120;
      if (clamped.x < nearTopLeftThreshold && clamped.y < topBoundary + 40) {
        return { position: fallback, isDefaultPosition: true };
      }

      if (positionsAreEqual(clamped, fallback)) {
        return { position: fallback, isDefaultPosition: true };
      }

      // Only reuse a stored position if the user explicitly moved the widget previously.
      if (!parsedMoved) {
        // clear non-user-moved saved position
        try {
          window.sessionStorage.removeItem(storageKey);
        } catch {}
        return { position: fallback, isDefaultPosition: true };
      }

      return {
        position: clamped,
        isDefaultPosition: false,
      };
    }

    // If stored value is invalid, clear it and fall back to default
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {}
    return { position: fallback, isDefaultPosition: true };
  } catch {
    return { position: fallback, isDefaultPosition: true };
  }
}

export function useDraggablePosition(options: Options) {
  const { storageKey, buttonSize, viewportMargin, topBoundary } = options;

  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isDefaultPosition, setIsDefaultPosition] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const draggedRef = useRef(false);
  const userMovedRef = useRef(false);

  const clampPosition = useCallback(
    (next: Position) =>
      clampToViewport({
        position: next,
        buttonSize,
        viewportMargin,
        topBoundary,
      }),
    [buttonSize, topBoundary, viewportMargin]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hydrated = getHydratedPosition({
      storageKey,
      buttonSize,
      viewportMargin,
      topBoundary,
    });

    setPosition(hydrated.position);
    setIsDefaultPosition(hydrated.isDefaultPosition);
    setHasHydrated(true);
  }, [buttonSize, storageKey, topBoundary, viewportMargin]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) {
      return;
    }

    // Persist position along with whether the user actively moved the widget.
    const payload = { x: position.x, y: position.y, moved: Boolean(userMovedRef.current) };
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [hasHydrated, position, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onResize = () => {
      setPosition((prev) => clampPosition(prev));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition]);

  const dragHandlers = useMemo(
    () => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) {
          return;
        }

        pointerStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y,
          moved: false,
        };

        draggedRef.current = false;
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
        const state = pointerStateRef.current;
        if (state.pointerId !== event.pointerId) {
          return;
        }

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;

        if (!state.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          state.moved = true;
          draggedRef.current = true;
        }

        if (!state.moved) {
          return;
        }
        // mark that the user has actively moved the widget during this session
        userMovedRef.current = true;
        setPosition(
          clampPosition({
            x: state.originX + dx,
            y: state.originY + dy,
          })
        );
      },
      onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (pointerStateRef.current.pointerId !== event.pointerId) {
          return;
        }

        const didMove = pointerStateRef.current.moved;

        pointerStateRef.current.pointerId = null;
        setIsDragging(false);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // no-op
        }
        // If the pointer session moved the widget, ensure we persist that the user moved it
        if (didMove) {
          userMovedRef.current = true;
          setPosition((prev) =>
            snapToViewportBoundary({
              position: prev,
              buttonSize,
              viewportMargin,
              topBoundary,
            })
          );
        }
      },
      onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (pointerStateRef.current.pointerId !== event.pointerId) {
          return;
        }

        pointerStateRef.current.pointerId = null;
        setIsDragging(false);
      },
    }),
    [clampPosition, position.x, position.y]
  );

  const consumeDragged = useCallback(() => {
    const didDrag = draggedRef.current;
    draggedRef.current = false;
    return didDrag;
  }, []);

  return {
    position,
    isDragging,
    hasHydrated,
    isDefaultPosition,
    dragHandlers,
    consumeDragged,
  };
}
