import React, { useEffect, useState } from 'react';
import type { VJLPerson } from '../types/VJLPerson';
import './CitationGuessHistory.css';
import { Tooltip } from './Tooltip';

interface CitationGuessHistoryProps {
  guesses: VJLPerson[];
  guessCounts: Record<number, number>;
  lastWrongId?: number;
  lastCorrectId?: number;
  answerId?: number; // id de la bonne réponse
}

const CitationGuessHistory: React.FC<CitationGuessHistoryProps> = ({ guesses, guessCounts, lastWrongId, lastCorrectId, answerId }) => {
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
    <div className="citation-guess-history">
      {guesses.slice().reverse().map((person) => {
        let extraClass = '';
        if (shakeId === person.id) extraClass = ' headshake';
        if (tadaId === person.id) extraClass = ' tada';
        if (answerId && answerId === person.id) extraClass += ' tada';
        return (
          <div
            key={person.id}
            className={'citation-guess-box' + extraClass}
          >
            {/* Icône et nombre en haut à droite */}
              <div className="citation-guess-people">
                <Tooltip content="Le nombre de joueurs qui ont également essayé ce membre">
                    <img src="/people.png" alt="personnes" width={26} height={26} style={{ display: 'block', margin: '0 auto' }} />
                    <div className="citation-guess-people-count">{guessCounts[person.id] ?? 0}</div>
                </Tooltip>
              </div>
            {/* Pfp et prénom au centre */}
            <div className="citation-guess-center">
              <img src={'pfps/' + person.pfp} alt={person.prenom} className="citation-guess-pfp" />
              <div className="citation-guess-name">{person.prenom}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CitationGuessHistory;
