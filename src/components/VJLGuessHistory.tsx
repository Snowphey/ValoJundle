import React from "react";
import CardColumn from "./CardColumn";
import type { CardStatus } from "./CardColumn";
import "./VJLGuessHistory.css";
import { Tooltip } from "./Tooltip";
import type { VJLPerson } from '../types/VJLPerson';

interface Attribute {
  key: keyof VJLPerson;
  label: string;
}

interface VJLGuessHistoryProps {
  guesses: VJLPerson[];
  answer: VJLPerson;
  attributes: Attribute[];
  animatingIndex: number | null;
  showResult: boolean;
}

function getStatus(guess: VJLPerson, answer: VJLPerson, key: keyof VJLPerson): CardStatus {
  if (key === 'height') {
    if (guess.height == answer.height) return 'correct';
    if (guess.height < answer.height) return 'higher';
    return 'lower';
  }
  if (key === 'birthDate') {
    if (guess.birthDate === answer.birthDate) return 'correct';
    if (guess.birthDate < answer.birthDate) return 'higher';
    return 'lower';
  }
  if (Array.isArray(guess[key]) && Array.isArray(answer[key])) {
    return (guess[key] as string[]).some(val => (answer[key] as string[]).includes(val)) ?
      ((guess[key] as string[]).join() === (answer[key] as string[]).join() ? 'correct' : 'partial') : 'incorrect';
  }
  if (guess[key] === answer[key]) return 'correct';
  if (
    typeof guess[key] === 'string' &&
    typeof answer[key] === 'string' &&
    guess[key] && answer[key] &&
    (guess[key] as string).toLowerCase().includes((answer[key] as string).toLowerCase())
  ) return 'partial';
  return 'incorrect';
}

const VJLGuessHistory: React.FC<VJLGuessHistoryProps> = ({ guesses, answer, attributes }) => {
  // On définit dynamiquement le nombre de colonnes pour le CSS (inclut pfp)
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vjl-nb-cols', attributes.length.toString());
  }, [attributes.length]);

  return (
    <div className="vjl-guess-history-scroll">
      <div className="vjl-guess-history">
        {/* En-tête des colonnes */}
        <div
          className="vjl-guess-history-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: 0,
          }}
        >
          {attributes.map((attr) => (
            <div
              key={attr.key}
              className="card-label"
              style={{ flex: `1 1 0`, textAlign: 'center' }}
            >
              {attr.key === 'pfp' ? (
                attr.label
              ) : (
                <Tooltip content={(() => {
                  switch(attr.key) {
                    case 'gender':
                      return 'Masculin ou Féminin';
                    case 'mainRoles':
                      return 'Top, Jungle, Mid, ADC, Support, ou Aucun';  
                    case 'hairColor':
                      return 'Brun, Blond, etc...';
                    case 'eyeColors':
                      return 'Marron, Bleu, etc...';
                    case 'height':
                      return 'Toute taille entre 100 et 300 cm';
                    case 'option':
                      return 'IA, ICC, Cyber, INEM, HPDA ou Aucune';
                    case 'birthRegion':
                      return 'Bretagne, Normandie, etc...';
                    case 'birthDate':
                      return 'Toute date entre 1990 et 2005';
                    default:
                      return attr.label;
                  }
                })()}>
                  <span>{attr.label}</span>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
        {guesses.slice().reverse().map((guess, idx) => {
          // Calculer l'index réel dans guesses pour l'animation
          const guessIdx = guesses.length - 1 - idx;
          return (
            <div
              key={guessIdx}
              className="vjl-guess-history-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                gap: 0,
              }}
            >
              {attributes.map((attr, i) => {
                const delay = attr.key === 'pfp' ? 0 : (i - 1) * 500;
                return (
                  <div key={attr.key + '-' + guessIdx} style={{ flex: '1 1 0', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CardColumn
                      value={
                        attr.key === 'pfp'
                          ? (
                            <img
                              src={'pfps/' + guess.pfp}
                              alt={guess.prenom || guess.pfp}
                            />
                          )
                          : Array.isArray(guess[attr.key])  
                          ? (guess[attr.key] as string[]).join(', ')
                          : attr.key === 'height'
                          ? `${guess.height || 0} cm`
                          : attr.key === 'birthDate'
                          ? new Date(guess.birthDate).toLocaleDateString()
                          : (guess[attr.key] as string)
                      }
                      status={
                        attr.key === 'pfp'
                          ? undefined
                          : getStatus(guess, answer, attr.key)
                      }
                      delay={delay}
                      showArrow={attr.key === 'height' || attr.key === 'birthDate'}
                      isPfp={attr.key === 'pfp'}
                      pfpName={attr.key === 'pfp' ? guess.prenom : undefined}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VJLGuessHistory;
