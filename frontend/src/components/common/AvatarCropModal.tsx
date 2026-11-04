import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const CROP_SIZE = 256;
const OUTPUT_SIZE = 512;

interface AvatarCropModalProps {
  file: File;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

interface Offset {
  x: number;
  y: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const AvatarCropModal = ({ file, onCancel, onSave }: AvatarCropModalProps) => {
  const [image, setImage] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [error, setError] = useState<string>();
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>();

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setError('Unable to read that image.');
    nextImage.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const layout = useMemo(() => {
    if (!image) return null;
    const baseScale = Math.max(
      CROP_SIZE / image.naturalWidth,
      CROP_SIZE / image.naturalHeight,
    );
    const scale = baseScale * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return {
      scale,
      width,
      height,
      maxX: Math.max(0, (width - CROP_SIZE) / 2),
      maxY: Math.max(0, (height - CROP_SIZE) / 2),
    };
  }, [image, zoom]);

  useEffect(() => {
    if (!layout) return;
    setOffset((current) => ({
      x: clamp(current.x, -layout.maxX, layout.maxX),
      y: clamp(current.y, -layout.maxY, layout.maxY),
    }));
  }, [layout]);

  const clampOffset = (next: Offset): Offset => {
    if (!layout) return next;
    return {
      x: clamp(next.x, -layout.maxX, layout.maxX),
      y: clamp(next.y, -layout.maxY, layout.maxY),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(
      clampOffset({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSave = () => {
    if (!image || !layout) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Unable to crop that image.');
      return;
    }

    const sourceSize = CROP_SIZE / layout.scale;
    const sourceX = clamp(
      (layout.width / 2 - offset.x - CROP_SIZE / 2) / layout.scale,
      0,
      image.naturalWidth - sourceSize,
    );
    const sourceY = clamp(
      (layout.height / 2 - offset.y - CROP_SIZE / 2) / layout.scale,
      0,
      image.naturalHeight - sourceSize,
    );

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="avatar-crop-title" className="text-xl font-semibold">Crop profile photo</h2>
        <p className="mt-1 text-sm text-muted">Drag the image to position it, then adjust the zoom.</p>

        <div className="mt-4 flex justify-center">
          {image && layout ? (
            <div
              className="relative touch-none overflow-hidden rounded-full border border-surface-line bg-surface-soft"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={image.src}
                alt="Crop preview"
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  left: CROP_SIZE / 2 - layout.width / 2 + offset.x,
                  top: CROP_SIZE / 2 - layout.height / 2 + offset.y,
                  width: layout.width,
                  height: layout.height,
                }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-full bg-surface-soft text-sm text-muted"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
            >
              {error ?? 'Loading image…'}
            </div>
          )}
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm">
          <span className="flex-none text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </label>

        {error && image && (
          <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-surface-line px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!image}
            className="rounded-xl bg-primary px-4 py-2 font-semibold disabled:opacity-50"
          >
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
