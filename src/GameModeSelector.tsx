import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './GameModeSelector.css';
import { Tooltip } from './components/Tooltip';
import { MODES } from './data/modes';
import { useWonModes } from './WonModesContext';

const GameModeSelector: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.replace(/^\//, '') || 'classic';
  const { wonModes } = useWonModes();

  return (
    <div className="game-mode-selector">
      <div className="rope-bg"/>
      <div className="modes">
        {MODES.map(mode => (
          <div key={mode.key} className="mode-btn-wrapper">
            <Tooltip content={mode.label}>
              <button
                className={`mode-btn${current === mode.key ? ' selected' : ''}`}
                onClick={current === mode.key ? undefined : () => navigate(`/${mode.key}`)}
                aria-label={mode.label}
                disabled={current === mode.key}
                tabIndex={current === mode.key ? -1 : 0}
                style={current === mode.key ? { cursor: 'default' } : {}}
              >
                <img
                  src={mode.img}
                  alt={mode.label}
                  className={current === mode.key ? '' : 'bw'}
                />
                {wonModes.includes(mode.key) && (
                  <span className="mode-btn-check">
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 10.5L9 14L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameModeSelector;
