/**
 * Bottom Sheet Component
 *
 * Draggable bottom sheet for mobile UI with snap points.
 * Large touch target at top for easy swipe gestures.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface BottomSheetProps {
  children: ReactNode;
  /** Snap points as percentages of screen height (0-100) */
  snapPoints?: number[];
  /** Initial snap point index */
  initialSnap?: number;
  /** Header content (always visible) */
  header?: ReactNode;
  /** Called when sheet position changes */
  onSnapChange?: (snapIndex: number) => void;
}

export function BottomSheet({
  children,
  snapPoints = [15, 50, 90],
  initialSnap = 1,
  header,
  onSnapChange,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const scrollAccumulator = useRef(0);
  const lastWheelTime = useRef(0);

  const currentHeight = snapPoints[currentSnap];
  const isCollapsed = currentSnap === 0;

  const snapTo = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(snapPoints.length - 1, index));
    if (clampedIndex !== currentSnap) {
      setCurrentSnap(clampedIndex);
      onSnapChange?.(clampedIndex);
      scrollAccumulator.current = 0;
    }
  }, [currentSnap, snapPoints.length, onSnapChange]);

  // Global wheel handler - works anywhere in the app
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();

      if (now - lastWheelTime.current > 200) {
        scrollAccumulator.current = 0;
      }
      lastWheelTime.current = now;

      const content = contentRef.current;
      if (content) {
        const rect = content.getBoundingClientRect();
        const isOverContent = e.clientY >= rect.top && e.clientY <= rect.bottom &&
                              e.clientX >= rect.left && e.clientX <= rect.right;

        if (isOverContent) {
          const hasScrollableContent = content.scrollHeight > content.clientHeight + 10;
          const isAtTop = content.scrollTop <= 0;
          const isAtBottom = content.scrollTop + content.clientHeight >= content.scrollHeight - 1;

          if (hasScrollableContent && !isAtTop && !isAtBottom) {
            return;
          }

          if (isAtTop && e.deltaY < 0 && hasScrollableContent) {
            scrollAccumulator.current += Math.abs(e.deltaY);
            if (scrollAccumulator.current > 100 && currentSnap > 0) {
              snapTo(currentSnap - 1);
              e.preventDefault();
            }
            return;
          }

          if (isAtBottom && e.deltaY > 0) {
            scrollAccumulator.current += Math.abs(e.deltaY);
            if (scrollAccumulator.current > 100 && currentSnap < snapPoints.length - 1) {
              snapTo(currentSnap + 1);
              e.preventDefault();
            }
            return;
          }
        }
      }

      scrollAccumulator.current += Math.abs(e.deltaY);

      if (scrollAccumulator.current > 100) {
        if (e.deltaY > 0) {
          if (currentSnap < snapPoints.length - 1) {
            snapTo(currentSnap + 1);
            e.preventDefault();
          }
        } else {
          if (currentSnap > 0) {
            snapTo(currentSnap - 1);
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentSnap, snapPoints.length, snapTo]);

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startHeight.current = currentHeight;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.touches[0].clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    setDragOffset(deltaPercent);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;

    const newHeight = Math.max(0, Math.min(100, startHeight.current + dragOffset));

    let closestSnap = 0;
    let minDistance = Infinity;
    snapPoints.forEach((point, index) => {
      const distance = Math.abs(point - newHeight);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnap = index;
      }
    });

    // Lower threshold for easier swiping (5% instead of 10%)
    if (Math.abs(dragOffset) > 5) {
      if (dragOffset > 0 && closestSnap < snapPoints.length - 1) {
        closestSnap = Math.min(closestSnap + 1, snapPoints.length - 1);
      } else if (dragOffset < 0 && closestSnap > 0) {
        closestSnap = Math.max(closestSnap - 1, 0);
      }
    }

    setCurrentSnap(closestSnap);
    setDragOffset(0);
    setIsDragging(false);
    onSnapChange?.(closestSnap);
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startHeight.current = currentHeight;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      setDragOffset(deltaPercent);
    };

    const handleMouseUp = () => handleDragEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const displayHeight = isDragging
    ? Math.max(snapPoints[0], Math.min(snapPoints[snapPoints.length - 1], startHeight.current + dragOffset))
    : currentHeight;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl shadow-2xl z-40 flex flex-col ${
        isDragging ? '' : 'transition-all duration-300 ease-out'
      }`}
      style={{ height: `${displayHeight}dvh` }}
    >
      {/* Large swipe area - easy to grab with thumb */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleMouseDown}
      >
        {/* Visual handle + hint */}
        <div className="flex flex-col items-center pt-2 pb-1">
          <div className="w-16 h-2 bg-gray-600 rounded-full mb-1" />
          {!isCollapsed && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <ChevronDown className="w-3 h-3" />
              <span>Swipe for map</span>
            </div>
          )}
        </div>

        {/* Tap zones for quick snap */}
        <div className="flex justify-center gap-3 pb-2">
          {snapPoints.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                snapTo(index);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentSnap === index ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Header content - interactive elements work normally */}
      {header && (
        <div className="flex-shrink-0 px-4 pb-3 border-b border-gray-800">
          <div onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            {header}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain min-h-0"
      >
        {children}
      </div>
    </div>
  );
}
