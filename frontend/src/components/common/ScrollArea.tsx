import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

const THUMB_HEIGHT = 48;
const TRACK_INSET_TOP = 129;
const TRACK_INSET_BOTTOM = 91;

interface ScrollAreaProps {
  className?: string;
  wrapperClassName?: string;
  contentClassName?: string;
  railClassName?: string;
  thumbHeight?: number;
  trackInsetTop?: number;
  trackInsetBottom?: number;
  hideRail?: boolean;
  children: ReactNode;
}

const ScrollArea = ({
  className = '',
  wrapperClassName = '',
  contentClassName = '',
  railClassName = 'right-2',
  thumbHeight = THUMB_HEIGHT,
  trackInsetTop = TRACK_INSET_TOP,
  trackInsetBottom = TRACK_INSET_BOTTOM,
  hideRail = false,
  children,
}: ScrollAreaProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
  const [rail, setRail] = useState({ visible: false, thumbTop: 0 });

  const sync = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    const travel = viewport.clientHeight - trackInsetTop - trackInsetBottom - thumbHeight;
    if (maxScroll <= 0 || travel <= 0) {
      setRail({ visible: false, thumbTop: 0 });
      return;
    }
    setRail({ visible: true, thumbTop: (viewport.scrollTop / maxScroll) * travel });
  }, [thumbHeight, trackInsetTop, trackInsetBottom]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [sync]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag || drag.pointerId !== event.pointerId) return;

    const travel = viewport.clientHeight - trackInsetTop - trackInsetBottom - thumbHeight;
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    if (travel <= 0 || maxScroll <= 0) return;

    viewport.scrollTop =
      drag.startScrollTop + ((event.clientY - drag.startY) * maxScroll) / travel;
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className={`relative w-full ${wrapperClassName}`}>
      <div
        ref={viewportRef}
        onScroll={sync}
        className={`scrollbar-none h-full overflow-y-auto ${className}`}
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>

      {!hideRail && rail.visible && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute w-2 ${railClassName}`}
          style={{ top: trackInsetTop, bottom: trackInsetBottom }}
        >
          <div
            className="pointer-events-auto absolute inset-x-0 rounded-full bg-primary"
            style={{
              height: thumbHeight,
              transform: `translateY(${rail.thumbTop}px)`,
              touchAction: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
      )}
    </div>
  );
};

export default ScrollArea;
