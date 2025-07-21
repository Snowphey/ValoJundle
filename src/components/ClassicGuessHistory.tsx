import React from "react";
import CardColumn from "./CardColumn";
import type { CardStatus } from "./CardColumn";
import "./ClassicGuessHistory.css";
import { Tooltip } from "./Tooltip";
import type { VJLPerson } from '../types/VJLPerson';

interface Attribute {
  key: keyof VJLPerson;
  label: string;
}

interface ClassicGuessHistoryProps {
  guesses: VJLPerson[];
  answer: VJLPerson;
  attributes: Attribute[];
  guessCounts: Record<number, number>;
  /**
   * Optional callback fired when the last guess line's animation ends (for win confetti logic)
   */
  onLastLineAnimationEnd?: () => void;
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

const ClassicGuessHistory: React.FC<ClassicGuessHistoryProps> = ({ guesses, answer, attributes, guessCounts, onLastLineAnimationEnd }) => {
  // On définit dynamiquement le nombre de colonnes pour le CSS (inclut pfp)
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vjl-nb-cols', attributes.length.toString());
  }, [attributes.length]);

  // Track if we've already called the callback to avoid multiple calls
  const lastLineCallbackCalled = React.useRef(false);

  if (guesses.length === 0) return null;

  return (
    <div className="classic-guess-history-scroll">
      <div className="classic-guess-history">
        {guesses.length > 0 && (
          <div
            className="classic-guess-history-header"
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
                {attr.key === 'avatarUrl' ? (
                  attr.label
                ) : (
                  <Tooltip direction="bottom" content={(() => {
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
        )}
        {guesses.slice().reverse().map((guess, idx) => {
          // Calculer l'index réel dans guesses pour l'animation
          const guessIdx = guesses.length - 1 - idx;
          const isLastGuess = guessIdx === guesses.length - 1;
          return (
            <div
              key={guessIdx}
              className="classic-guess-history-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                gap: 0,
                position: 'relative',
              }}
            >
              {attributes.map((attr, i) => {
                const delay = attr.key === 'avatarUrl' ? 0 : (i - 1) * 500;
                // For the last attribute of the last guess, attach animation end handler
                const isLastAttr = i === attributes.length - 1;
                const handleAnimationEnd = () => {
                  if (isLastGuess && isLastAttr && onLastLineAnimationEnd && !lastLineCallbackCalled.current) {
                    lastLineCallbackCalled.current = true;
                    onLastLineAnimationEnd();
                  }
                };
                return (
                  <div key={attr.key + '-' + guessIdx} style={{ flex: '1 1 0', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    {/* Ajout du compteur en haut à droite de la pfp */}
                    {attr.key === 'avatarUrl' && (
                      <div style={{ position: 'absolute', top: 2, right: 20, zIndex: 2 }}>
                        <Tooltip content="Le nombre de joueurs qui ont également essayé ce membre">
                          <img src="/people.png" alt="personnes" width={20} height={20} style={{ display: 'block', margin: '0 auto' }} />
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', textShadow: '0 1px 2px #0008', textAlign: 'center' }}>{guessCounts[guess.id] ?? 0}</div>
                        </Tooltip>
                      </div>
                    )}
                    <CardColumn
                      value={
                        attr.key === 'avatarUrl'
                          ? (
                            <img
                              src={guess.avatarUrl ? `${guess.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''}
                              alt={guess.prenom || ''}
                              style={{ objectFit: 'cover', background: '#222' }}
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
                        attr.key === 'avatarUrl'
                          ? undefined
                          : getStatus(guess, answer, attr.key)
                      }
                      delay={delay}
                      showArrow={attr.key === 'height' || attr.key === 'birthDate'}
                      isPfp={attr.key === 'avatarUrl'}
                      pfpName={attr.key === 'avatarUrl' ? guess.prenom : undefined}
                      {...(isLastGuess && isLastAttr && onLastLineAnimationEnd ? { onAnimationEnd: handleAnimationEnd } : {})}
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

export default ClassicGuessHistory;
