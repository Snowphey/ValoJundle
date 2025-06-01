import React, { useState, useEffect, useCallback } from 'react';
import VJLGuessInput from './components/VJLGuessInput';
import './ValoJundleTheme.css';
import type { VJLPerson } from './types/VJLPerson';
import VictoryBox from './components/VictoryBox';
import AnimatedCounter from './components/AnimatedCounter';
import { useWonModes } from './WonModesContext';
import CitationGuessHistory from './components/CitationGuessHistory';
import { buildShareText } from './utils/buildShareText';
import { loadGame as apiLoadGame, saveGame as apiSaveGame, fetchAnswerIdAndGameId, fetchWinnersCount, getPersonById, fetchTodayFromBackend, fetchCitationOfTheDay, fetchGuessCounts, fetchCronReadyFromBackend } from './api/api';
import AllModesShareBox from './components/AllModesShareBox';
import { getAnswerForDate } from './utils/getAnswerForDate';
import YesterdayAnswerBox from './components/YesterdayAnswerBox';

const GAME_MODE = 'citation';

// Contrôle de la date du puzzle (logique "Loldle")
(function checkCitationDate() {
  const getParisDateString = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    }).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };
  const todayParis = getParisDateString();
  const key = 'citation_last_played';
  const lastPlayed = localStorage.getItem(key);
  if (lastPlayed && lastPlayed !== todayParis) {
    // Reset la partie (ici, on clear juste la clé du mode et reload)
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('citation')) localStorage.removeItem(k);
    });
    localStorage.setItem(key, todayParis);
    window.location.reload();
  } else {
    localStorage.setItem(key, todayParis);
  }
})();

const CitationPage: React.FC = () => {
  const [answer, setAnswer] = useState<VJLPerson | null>(null);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [hasWon, setHasWon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [historyCopied, setHistoryCopied] = useState(false);
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [gameId, setGameId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('00:00:00');
  const resultRef = React.useRef<HTMLDivElement>(null);
  const [scrollToResult, setScrollToResult] = useState(false);
  const { refreshWonModes } = useWonModes();
  const [mainMessage, setMainMessage] = useState<any | null>(null);
  const [guessCounts, setGuessCounts] = useState<Record<number, number>>({});
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [lastWrongId, setLastWrongId] = useState<number | undefined>(undefined);
  const [lastCorrectId, setLastCorrectId] = useState<number | undefined>(undefined);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [yesterdayAnswer, setYesterdayAnswer] = useState<VJLPerson | null>(null);
  const [yesterdayGameId, setYesterdayGameId] = useState<number | null>(null);

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
        // Citation Discord du jour (déterministe)
        if (answerObj?.discordUserId) {
          const msg = await fetchCitationOfTheDay(answerObj.discordUserId);
          setMainMessage(msg);
        } else {
          setMainMessage(null);
        }
        // Puis charge la partie
        const state = await apiLoadGame(GAME_MODE);
        setGuesses(state.guesses || []);
        setHasWon(state.hasWon || false);
        if (typeof state.rank === 'number') setMyRank(state.rank);
        // Récupère les guessCounts
        const counts = await fetchGuessCounts(GAME_MODE);
        setGuessCounts(counts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Rafraîchit guessCounts en temps réel
  useEffect(() => {
    let stop = false;
    async function fetchCounts() {
      try {
        const counts = await fetchGuessCounts(GAME_MODE);
        if (!stop) setGuessCounts(counts);
      } catch {}
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, 2000);
    return () => { stop = true; clearInterval(interval); };
  }, []);

  // Sauvegarde la partie à chaque changement
  useEffect(() => {
    if (!loading) {
      apiSaveGame(GAME_MODE, guesses, hasWon, myRank);
    }
  }, [guesses, hasWon, loading, myRank]);

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
    const interval = setInterval(fetchCount, 2000);
    return () => { stop = true; clearInterval(interval); };
  }, []);

  // Remplace handleGuess par la version ClassicPage
  const handleGuess = useCallback((person: VJLPerson) => {
    if (guesses.includes(person.id)) return;
    setGuesses(prev => [...prev, person.id]);
    setAnimatingIndex(0);
    setShowConfetti(false);
    setScrollToResult(false);
    if (answer && person.id === answer.id) {
      setLastCorrectId(person.id);
    } else {
      setLastWrongId(person.id);
    }
  }, [guesses, answer]);

  // Pour récupérer le dernier guess en tant qu'objet VJLPerson
  const lastGuess = guesses.length > 0 ? getPersonById(guesses[guesses.length - 1]) : undefined;

  // Animation et gestion victoire comme ClassicPage
  useEffect(() => {
    if (animatingIndex === null) return;
    if (animatingIndex < 1) { // Citation n'a qu'une colonne, donc 1 étape
      const timeout = setTimeout(() => setAnimatingIndex(animatingIndex + 1), 420);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setAnimatingIndex(null);
        if (guesses.length > 0 && lastGuess && lastGuess.id === answer?.id) {
          setShowConfetti(true);
          setTimeout(async () => {
            setHasWon(true);
            await apiSaveGame(GAME_MODE, [...guesses], true);
            refreshWonModes();
            setTimeout(() => setScrollToResult(true), 600);
          }, 1200);
        }
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [animatingIndex, guesses, answer, lastGuess]);

  // Chronomètre (reset à minuit Europe/Paris)
  useEffect(() => {
    let cancelled = false;
    if (!hasWon) return;
    const getNowParis = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const hour = parts.find(p => p.type === 'hour')?.value;
      const minute = parts.find(p => p.type === 'minute')?.value;
      const second = parts.find(p => p.type === 'second')?.value;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    };
    const getNextResetParis = (nowParis: Date) => {
      const nextParis = new Date(nowParis);
      nextParis.setHours(24, 0, 0, 0);
      if (nowParis >= nextParis) nextParis.setDate(nextParis.getDate() + 1);
      return nextParis;
    };
    const runTimer = async () => {
      while (!cancelled) {
        const nowParis = getNowParis();
        const next = getNextResetParis(nowParis);
        const diff = next.getTime() - nowParis.getTime();
        if (diff <= 0) {
          setCountdown('00:00:00');
          // Attendre que le backend ait bien fini le cron (flag explicite)
          let ready = false;
          while (!ready) {
            try {
              ready = await fetchCronReadyFromBackend();
            } catch {}
            if (!ready) await new Promise(res => setTimeout(res, 1000));
          }
          window.location.reload();
          break;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        const msToNextSecond = 1000 - (Date.now() % 1000);
        await new Promise(res => setTimeout(res, msToNextSecond));
      }
    };
    runTimer();
    return () => { cancelled = true; };
  }, [hasWon]);

  // Gestion du copier (texte à partager)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setHistoryCopied(true);
      setTimeout(() => setHistoryCopied(false), 1800);
    } catch {
      setHistoryCopied(false);
    }
  };

  // Génère le texte à partager (simple pour l'instant)
  function getShareText() {
    if (!answer) return '';
    return buildShareText(guessObjects, answer, [], 'citation', gameId?.toString() ?? '?');
  }

  // Pour l'affichage des guesses
  const guessObjects = guesses.map(id => getPersonById(id)).filter(Boolean) as VJLPerson[];
  // Utilise le vrai guessCounts récupéré du backend
  // TODO: Récupérer le vrai nombre de joueurs ayant tenté chaque guess via l'API (optionnel)

  // Confetti (optionnel)
  useEffect(() => {
    if (showConfetti) {
      import('./confetti').then(({ default: confetti }) => {
        window.requestAnimationFrame(() => {
          confetti({ particleCount: 180, spread: 90, origin: { y: 0.5 }, zIndex: 9999 });
        });
      });
    }
  }, [showConfetti]);

  useEffect(() => {
    if (scrollToResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScrollToResult(false);
    }
  }, [scrollToResult]);

  // Récupère la réponse d'hier au chargement
  useEffect(() => {
    (async () => {
      const today = await fetchTodayFromBackend();
      const todayDate = new Date(today);
      const yesterday = new Date(todayDate);
      yesterday.setDate(todayDate.getDate() - 1);
      const yDate = yesterday.toISOString().slice(0, 10);
      const yAnswerId = getAnswerForDate(GAME_MODE, yDate);
      if (yAnswerId) {
        const { gameId: yGameId } = await fetchAnswerIdAndGameId(GAME_MODE, yDate);
        setYesterdayGameId(yGameId);
        const yAnswerObj = getPersonById(yAnswerId);
        setYesterdayAnswer(yAnswerObj || null);
      }
    })();
  }, []);

  // Enregistre le rang du joueur à la victoire
  useEffect(() => {
    if (hasWon && myRank === null && gameId) {
      (async () => {
        const count = await fetchWinnersCount(GAME_MODE);
        setMyRank(count + 1); // +1 car on vient de gagner
        apiSaveGame(GAME_MODE, guesses, true, count + 1); // Sauvegarde aussi le rang
      })();
    }
  }, [hasWon, myRank, gameId]);

  if (loading || !answer || !mainMessage) return <div>Chargement...</div>;

  return (
    <div>
      {/* Citation box */}
      <div style={{
        background: 'rgba(24,28,36,0.92) center/cover no-repeat',
        borderRadius: 18,
        border: '2px solid #af9767',
        boxShadow: '0 2px 16px #000a',
        padding: '32px 18px 24px 18px',
        margin: '0 auto 24px auto',
        maxWidth: 540,
        position: 'relative',
        color: '#fff',
        textAlign: 'center',
        fontFamily: 'Friz Quadrata Std, Mobilo, Helvetica, Arial, sans-serif',
      }}>
        <div style={{ fontSize: '1.25rem', marginBottom: 8, fontWeight: 700 }}>Qui a dit :</div>
        <div style={{ fontSize: '2rem', fontStyle: 'italic', margin: '18px 0', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
          “ {mainMessage} ”
        </div>
      </div>
      {/* Input de guess */}
      {!hasWon && (
        <VJLGuessInput onGuess={handleGuess} />
      )}
      {/* Compteur de gagnants (mocké) */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
        <span style={{ color: '#f2ff7d', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 }}>
          <AnimatedCounter value={winnersCount} direction="up" />
        </span>
        <span style={{ color: '#fff', fontWeight: 500, fontSize: '1.1rem', marginLeft: 6 }}>
          {winnersCount > 1 ? 'personnes ont' : 'personne a'} trouvé !
        </span>
      </div>
      {/* Historique des guesses façon citation */}
      <CitationGuessHistory 
        guesses={guessObjects} 
        guessCounts={guessCounts} 
        lastWrongId={lastWrongId}
        lastCorrectId={lastCorrectId}
        answerId={answer.id}
      />
      <div style={{ marginTop: 36 }} />
      {/* Victoire */}
      {hasWon && (
        <div ref={resultRef} style={{ margin: '32px 0 24px 0' }}>
          <a
            href={mainMessage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="discord-link-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(90deg, #5865F2 60%, #404eed 100%)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 8,
              padding: '7px 18px 7px 12px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px #0005',
              border: 'none',
              transition: 'filter 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
            onMouseOut={e => (e.currentTarget.style.filter = '')}
          >
            <img src="/discord.png" alt="Discord" width={22} height={22} style={{verticalAlign:'middle', borderRadius:4}} />
            Voir sur Discord
          </a>
          <VictoryBox
            memberIcon={'pfps/' + answer.pfp}
            memberName={answer.prenom}
            attempts={guessObjects.length}
            nextMode="Image"
            nextModeImg={'next-image.png'}
            countdown={countdown}
            timezone="Europe/Paris (UTC+2)"
            rank={myRank}
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
          <AllModesShareBox />
        </div>
      )}
      {/* Réponse d'hier tout en bas */}
      {yesterdayAnswer && (
        <YesterdayAnswerBox yesterdayAnswer={yesterdayAnswer} gameId={yesterdayGameId ?? undefined} />
      )}
    </div>
  );
};

export default CitationPage;
