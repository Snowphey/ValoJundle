import React, { useMemo, useState } from 'react';
import './HoverZoom.css';

type HoverZoomProps = {
  children: React.ReactNode;
  scale?: number; // zoom scale factor
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
};

const HoverZoom: React.FC<HoverZoomProps> = ({ children, scale = 1.8, className = '', style, disabled }) => {
  const [zooming, setZooming] = useState(false);
  const [pos, setPos] = useState<{ xPct: number; yPct: number }>({ xPct: 50, yPct: 50 });

  const computedStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties & Record<string, any> = { ...(style || {}) } as any;
    base['--zoom-x'] = `${pos.xPct}%`;
    base['--zoom-y'] = `${pos.yPct}%`;
    base['--zoom-scale'] = String(scale);
    return base;
  }, [pos, scale, style]);

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setPos({ xPct, yPct });
  };

  const onEnter = () => {
    if (disabled) return;
    // Only enable on hover-capable devices
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      setZooming(true);
    }
  };
  const onLeave = () => setZooming(false);

  return (
    <div
      className={`hover-zoom-container ${zooming ? 'is-zooming' : ''} ${className}`}
      style={computedStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseMove={onMouseMove}
    >
      {children}
    </div>
  );
};

export default HoverZoom;
