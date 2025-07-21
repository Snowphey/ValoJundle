import React, { useEffect, useState } from 'react';
import type { VJLPerson } from '../types/VJLPerson';
import './GuessHistory.css';
import { Tooltip } from './Tooltip';

interface GuessHistoryProps {
  guesses: VJLPerson[];
  guessCounts: Record<number, number>;
  lastWrongId?: number;
  lastCorrectId?: number;
  answerId?: number; // id de la bonne réponse
  hardcore?: boolean;
}

const GuessHistory: React.FC<GuessHistoryProps> = ({ guesses, guessCounts, lastWrongId, lastCorrectId, answerId, hardcore }) => {
  const [shakeId, setShakeId] = useState<number | null>(null);
  const [tadaId, setTadaId] = useState<number | null>(null);
  useEffect(() => {
    if (lastWrongId) {
      setShakeId(lastWrongId);
      const timeout = setTimeout(() => setShakeId(null), 600);
      return () => clearTimeout(timeout);
    }
  }, [lastWrongId]);
  useEffect(() => {
    if (lastCorrectId) {
      setTadaId(lastCorrectId);
      const timeout = setTimeout(() => setTadaId(null), 800);
      return () => clearTimeout(timeout);
    }
  }, [lastCorrectId]);
  if (!guesses.length) return null;
  return (
    <div className="guess-history">
      {guesses.slice().reverse().map((person) => {
        let extraClass = '';
        if (shakeId === person.id) extraClass = ' headshake';
        if (tadaId === person.id) extraClass = ' tada';
        if (answerId && answerId === person.id) extraClass += ' tada';
        return (
          <div
            key={person.id}
            className={'guess-box' + extraClass}
          >
            {/* Icône et nombre en haut à droite */}
            {!hardcore && (
              <div className="guess-people">
                <Tooltip content="Le nombre de joueurs qui ont également essayé ce membre" direction='top'>
                    <img src="/people.png" alt="personnes" width={26} height={26} style={{ display: 'block', margin: '0 auto' }} />
                    <div className="guess-people-count">{guessCounts[person.id] ?? 0}</div>
                </Tooltip>
              </div>
            )}
            {/* Pfp et prénom au centre */}
            <div className="guess-center">
              <img src={person.avatarUrl ? `${person.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''} alt={person.prenom} className="guess-pfp" style={{ objectFit: 'cover', background: '#222' }} />
              <div className="guess-name">{person.prenom}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GuessHistory;
