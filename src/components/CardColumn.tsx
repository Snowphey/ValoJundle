import React from "react";
import type { ReactNode } from "react";
import "./CardColumn.css";

export type CardStatus = "correct" | "partial" | "incorrect" | "higher" | "lower";

interface CardColumnProps {
  label?: string;
  value: string | number | ReactNode;
  status?: CardStatus;
  delay: number;
  showLabel?: boolean;
  showArrow?: boolean;
  isPfp?: boolean; // Ajouté : indique si c'est la colonne pfp
  pfpName?: string; // Ajouté : prénom pour tooltip
}

const CardColumn: React.FC<CardColumnProps> = ({ label, value, status = 'incorrect', delay, showLabel, showArrow, isPfp, pfpName }) => {
  const [hovered, setHovered] = React.useState(false);
  const shouldShowArrow = showArrow && (status === 'higher' || status === 'lower');
  // Pas d'animation ni d'opacité pour pfp
  const animationStyle = isPfp ? {} : { animationDelay: `${delay}ms` };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {showLabel && label && (
        <div className="card-label">{label}</div>
      )}
      <div
        className={`card-column card-${status}${isPfp ? ' card-pfp' : ''}${hovered ? ' card-hovered' : ''}${shouldShowArrow ? ' card-arrow' : ''}`}
        style={{
          ...animationStyle,
          background: shouldShowArrow ? `url(${'red.webp'})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          cursor: isPfp ? 'pointer' : 'default',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="card-value" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          {shouldShowArrow && (
            <span
              className={`card-arrow-svg${hovered ? ' arrow-hovered' : ''}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: status === 'higher' ? 'rotate(0deg)' : 'rotate(180deg)',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
                <polygon
                  points="97,40 80,40 80,95 20,95 20,40 3,40 50,5"
                  fill={hovered ? '#4a0620' : '#7a0c0c'}
                />
              </svg>
            </span>
          )}
          <span style={{ position: 'relative', zIndex: 2 }}>
            {value}
          </span>
          {/* Tooltip prénom sur hover pfp */}
          {isPfp && hovered && pfpName && (
            <span className="pfp-tooltip">{pfpName}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardColumn;
