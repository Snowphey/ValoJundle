import React, { useEffect, useRef, useState } from 'react';
import './AnimatedCounter.css';

interface AnimatedCounterProps {
  value: number;
  duration?: number; // ms pour l'animation
  color?: string;
  fontSize?: string | number;
  direction?: 'up' | 'down'; // Ajout de la direction
}

// Affiche chaque chiffre dans une colonne qui "défile" verticalement
const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 600, color = '#f2ff7d', fontSize = '1.1rem', direction = 'up' }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Met à jour prevRef à chaque affichage
  useEffect(() => {
    prevRef.current = display;
  }, [display]);

  useEffect(() => {
    if (value !== display) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setDisplay(value), duration);
    }
  }, [value]);

  // Pour chaque chiffre, anime la colonne
  const prevStr = prevRef.current.toString().padStart(value.toString().length, '0');
  const valueStr = value.toString().padStart(prevStr.length, '0');

  return (
    <span style={{ display: 'inline-flex', gap: 2, color, fontWeight: 700, fontSize, letterSpacing: 1 }}>
      {valueStr.split('').map((digit, i) => {
        const prevDigit = prevStr[i] || '0';
        const isAnimating = display !== value && digit !== prevDigit;
        // Directions
        const toTransformPrev = direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)';
        const fromTransformNew = direction === 'up' ? 'translateY(100%)' : 'translateY(-100%)';

        return (
          <span key={i} className="animated-digit-wrapper" style={{ position: 'relative', width: '1ch', height: '1.3em', display: 'inline-block', overflow: 'hidden' }}>
            {isAnimating ? (
              <>
                <span
                  className="animated-digit animate"
                  style={{
                    display: 'inline-block',
                    transition: `transform ${duration}ms cubic-bezier(.4,1.6,.6,1)` ,
                    transform: toTransformPrev,
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
                  className="animated-digit animate"
                  style={{
                    display: 'inline-block',
                    transition: `transform ${duration}ms cubic-bezier(.4,1.6,.6,1)` ,
                    transform: fromTransformNew,
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    zIndex: 2,
                    animation: `${direction === 'up' ? 'counter-slide-up' : 'counter-slide-down'} ${duration}ms cubic-bezier(.4,1.6,.6,1) forwards`,
                  }}
                >
                  {digit}
                </span>
              </>
            ) : (
              <span
                className="animated-digit"
                style={{
                  display: 'inline-block',
                  transition: 'none',
                  transform: 'translateY(0)',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  zIndex: 2,
                }}
              >
                {digit}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

export default AnimatedCounter;
