import React, { useRef, useState, useLayoutEffect } from 'react';
import './Tooltip.css';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, className }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (visible && wrapperRef.current && tooltipRef.current) {
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const spaceAbove = wrapperRect.top;
      // Par défaut on affiche au dessus, sauf si pas la place
      if (spaceAbove > tooltipRect.height + 12) {
        setPosition('top');
      } else {
        setPosition('bottom');
      }
    }
  }, [visible]);

  return (
    <div
      className={`tooltip-wrapper ${className || ''}`}
      ref={wrapperRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      style={{ display: 'inline-block', position: 'relative' }}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          className={`tooltip-box tooltip-${position}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
