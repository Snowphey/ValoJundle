import React, { useEffect, useRef, useState } from 'react';
import './AnimatedCounter.css';

interface AnimatedCounterProps {
  value: number;
  duration?: number; // ms pour l'animation
  color?: string;
  fontSize?: string | number;
}

// Affiche chaque chiffre dans une colonne qui "défile" verticalement
const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 600, color = '#f2ff7d', fontSize = '1.1rem' }) => {
  const [prev, setPrev] = useState(value);
  const [display, setDisplay] = useState(value);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (value !== display) {
      setPrev(display);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setDisplay(value), duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Pour chaque chiffre, anime la colonne
  const prevStr = prev.toString().padStart(value.toString().length, '0');
  const valueStr = value.toString().padStart(prevStr.length, '0');

  return (
    <span style={{ display: 'inline-flex', gap: 2, color, fontWeight: 700, fontSize, letterSpacing: 1 }}>
      {valueStr.split('').map((digit, i) => {
        const prevDigit = prevStr[i] || '0';
        const isChanged = digit !== prevDigit && prev !== value;
        return (
          <span key={i} className="animated-digit-wrapper" style={{ position: 'relative', width: '1ch', height: '1.3em', display: 'inline-block', overflow: 'hidden' }}>
            <span
              className={`animated-digit${isChanged ? ' animate' : ''}`}
              style={{
                display: 'inline-block',
                transition: isChanged ? `transform ${duration}ms cubic-bezier(.4,1.6,.6,1)` : 'none',
                transform: isChanged ? 'translateY(-100%)' : 'translateY(0)',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                zIndex: 1,
              }}
            >
              {prevDigit}
            </span>
            <span
              className={`animated-digit${isChanged ? ' animate' : ''}`}
              style={{
                display: 'inline-block',
                transition: isChanged ? `transform ${duration}ms cubic-bezier(.4,1.6,.6,1)` : 'none',
                transform: isChanged ? 'translateY(0)' : 'translateY(100%)',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                zIndex: 2,
              }}
            >
              {digit}
            </span>
          </span>
        );
      })}
    </span>
  );
};

export default AnimatedCounter;
