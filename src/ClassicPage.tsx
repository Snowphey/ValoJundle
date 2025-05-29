import React, { useState, useCallback, useEffect } from 'react';
import VJLGuessInput from './components/VJLGuessInput';
import VJLGuessHistory from './components/VJLGuessHistory';
import ColorIndicator from './components/ColorIndicator';
import './ValoJundleTheme.css';
import vjlData from './data/vjl.json';
import VictoryBox from './components/VictoryBox';
import { buildShareText } from './utils/buildShareText';
import { loadGame as apiLoadGame, saveGame as apiSaveGame, fetchAnswerIdAndGameId, fetchWinnersCount, getPersonById, fetchTodayFromBackend } from './api/api';
import type { VJLPerson } from './types/VJLPerson';
import AnimatedCounter from './components/AnimatedCounter';
import { useWonModes } from './WonModesContext';

const ATTRIBUTES: { key: Exclude<keyof VJLPerson, 'id'>; label: string }[] = [
  { key: 'pfp', label: 'Membre' },
  { key: 'gender', label: 'Genre' },
  { key: 'mainRoles', label: 'Main role(s)' },
  { key: 'hairColor', label: 'Cheveux' },
  { key: 'eyeColors', label: 'Yeux' },
  { key: 'height', label: 'Taille (cm)' },
  { key: 'option', label: 'Option' },
  { key: 'birthRegion', label: 'Région de naissance' },
  { key: 'birthDate', label: 'Date de naissance' },
];

const GAME_MODE = 'classic';

const ClassicPage: React.FC = () => {
  const [answer, setAnswer] = useState<VJLPerson | null>(null);
  const [guesses, setGuesses] = useState<number[]>([]); // Stocke les ids numériques
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scrollToResult, setScrollToResult] = useState(false);
  const [historyCopied, setHistoryCopied] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [gameId, setGameId] = useState<number | null>(null);
  const { refreshWonModes } = useWonModes();

  // Chargement initial depuis le backend
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const today = await fetchTodayFromBackend();
        const { id: answerId, gameId } = await fetchAnswerIdAndGameId(GAME_MODE, today);
        setGameId(gameId);
        const answerObj = getPersonById(answerId);
        setAnswer(answerObj || null);
        // Puis charge la partie
        const data = await apiLoadGame(GAME_MODE);
        let state = data;
        if (Array.isArray(data)) {
          state = data.find((s) => s.gameId === gameId) || { guesses: [], hasWon: false, gameId };
        }
        setGuesses(state.guesses || []);
        setHasWon(state.hasWon || false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Sauvegarde la partie à chaque changement
  useEffect(() => {
    if (!loading) {
      apiSaveGame(GAME_MODE, guesses, hasWon);
    }
  }, [guesses, hasWon, loading]);

  // Récupère le nombre de gagnants au chargement et en temps réel
  useEffect(() => {
    let stop = false;
    async function fetchCount() {
      try {
        const count = await fetchWinnersCount(GAME_MODE);

        if (!stop) setWinnersCount(count);
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 2000); // rafraîchit toutes les 2s
    return () => { stop = true; clearInterval(interval); };
  }, []);

  const handleGuess = useCallback((person: VJLPerson) => {
    if (guesses.includes(person.id)) return;
    setGuesses(prev => [...prev, person.id]);
    setAnimatingIndex(0);
    setShowResult(false);
    setShowConfetti(false);
    setScrollToResult(false);
  }, [guesses]);

  // Pour récupérer le dernier guess en tant qu'objet VJLPerson
  const lastGuess = guesses.length > 0 ? vjlData.find(p => p.id === guesses[guesses.length - 1]) : undefined;

  React.useEffect(() => {
    if (animatingIndex === null) return;
    if (animatingIndex < ATTRIBUTES.length - 1) {
      const timeout = setTimeout(() => setAnimatingIndex(animatingIndex + 1), 420);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setAnimatingIndex(null);
        if (guesses.length > 0 && lastGuess && lastGuess.id === answer?.id) {
          setShowConfetti(true);
          setTimeout(async () => {
            setShowResult(true);
            setHasWon(true);
            await apiSaveGame(GAME_MODE, [...guesses], true);
            refreshWonModes();
            setTimeout(() => setScrollToResult(true), 600);
          }, 1200);
        } else {
          setShowResult(true);
        }
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [animatingIndex, guesses, answer, lastGuess]);

  React.useEffect(() => {
    if (showConfetti) {
      import('./confetti').then(({ default: confetti }) => {
        window.requestAnimationFrame(() => {
          confetti({
            particleCount: 180,
            spread: 90,
            origin: { y: 0.5 },
            zIndex: 9999,
          });
        });
      });
    }
  }, [showConfetti]);

  React.useEffect(() => {
    if (scrollToResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollToResult]);

  // Génération du texte d'historique à copier (reprend la logique de VJLGuessHistory)
  // Utilise la fonction utilitaire commune
  function getShareText(): string {
    if (!answer) return '';
    return buildShareText(guesses.map(id => getPersonById(id)!), answer, ATTRIBUTES, 'classique', gameId ? String(gameId) : '?');
  }

  // Chronomètre (exemple simple, à adapter si besoin)
  const [countdown, setCountdown] = useState('00:00:00');
  React.useEffect(() => {
    let cancelled = false;
    if (!(guesses.length > 0 && lastGuess && lastGuess.id === answer?.id && hasWon)) return;
    // Prochain reset à minuit UTC+2 (exemple)
    const getNextReset = () => {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(22, 0, 0, 0); // 22h UTC = minuit UTC+2
      if (now > next) next.setUTCDate(next.getUTCDate() + 1);
      return next;
    };
    const runTimer = async () => {
      while (!cancelled) {
        const now = new Date();
        const next = getNextReset();
        const diff = next.getTime() - now.getTime();
        if (diff <= 0) {
          setCountdown('00:00:00');
          // On attend un court instant pour afficher 00:00:00 puis on reload
          setTimeout(async () => {
            // On recharge la page pour obtenir la nouvelle partie (et donc la nouvelle date du backend)
            window.location.reload();
          }, 800);
          break;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        // Attend jusqu'à la prochaine seconde réelle
        const msToNextSecond = 1000 - (Date.now() % 1000);
        await new Promise(res => setTimeout(res, msToNextSecond));
      }
    };
    runTimer();
    return () => { cancelled = true; };
  }, [guesses, answer, hasWon, lastGuess]);

  // Gestion du copier
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setHistoryCopied(true);
      setTimeout(() => setHistoryCopied(false), 1800);
    } catch {
      setHistoryCopied(false);
    }
  };

  // Pour l'historique, il faut passer les objets VJLPerson :
  const guessObjects = guesses.map(id => getPersonById(id)).filter(Boolean) as VJLPerson[];

  if (loading || !answer) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Affiche l'input seulement si la réponse n'est pas trouvée */}
      {!hasWon && (
        <VJLGuessInput onGuess={handleGuess} />
      )}
      {/* Le compteur reste affiché même après la victoire */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
        <span style={{ color: '#f2ff7d', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 }}>
          <AnimatedCounter value={winnersCount} direction="up" />
        </span>
        <span style={{ color: '#fff', fontWeight: 500, fontSize: '1.1rem', marginLeft: 6 }}>
          {winnersCount > 1 ? 'personnes ont' : 'personne a'} trouvé !
        </span>
      </div>
      <div style={{ marginBottom: 18 }} />
      <VJLGuessHistory
        guesses={guessObjects} // Convertit les ids en objets
        answer={answer}
        attributes={ATTRIBUTES}
        animatingIndex={animatingIndex}
        showResult={showResult}
      />
      <ColorIndicator />
      {hasWon && (
        <>
          <div ref={resultRef} style={{ margin: '32px 0 24px 0' }}>
            <VictoryBox
              memberIcon={'pfps/' + answer.pfp}
              memberName={answer.prenom}
              attempts={guessObjects.length}
              nextMode="Citation"
              nextModeImg={'next-citation.png'}
              countdown={countdown}
              timezone="Europe/Paris (UTC+2)"
            />
            <div className="victory-history-box">
                <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', fontSize: '1.08rem', marginBottom: 8 }}>{getShareText()}</div>
                <button className="victory-history-copy-btn" onClick={handleCopy} type="button">
                    <span style={{display:'flex',alignItems:'center',gap:6}}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}} xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="3" width="12" height="14" rx="3" fill={historyCopied ? '#ffd700' : '#e6c559'} stroke="#3a2e14" strokeWidth="1.5"/>
                        <rect x="2" y="6" width="12" height="11" rx="2.5" fill="none" stroke="#bfa23a" strokeWidth="1.2"/>
                    </svg>
                    {historyCopied ? 'Copié !' : 'Copier'}
                    </span>
                </button>
            </div>
          </div>
        </>
      )}
      <div style={{ marginTop: 36 }} />
    </div>
  );
};

export default ClassicPage;