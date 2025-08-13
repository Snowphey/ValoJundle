import React, { useState, useCallback, useEffect } from 'react';
import GuessInput from './components/GuessInput';
import ClassicGuessHistory from './components/ClassicGuessHistory';
import ColorIndicator from './components/ColorIndicator';
import './ValoJundleTheme.css';
import VictoryBox from './components/VictoryBox';
import { buildShareText } from './utils/buildShareText';
import { loadGame as apiLoadGame, saveGame as apiSaveGame, fetchAnswer, fetchAnswerIfExists, fetchWinnersCount, fetchTodayFromBackend, fetchCronReadyFromBackend, fetchGuessCounts } from './api/api';
import type { VJLPerson } from './types/VJLPerson';
import AnimatedCounter from './components/AnimatedCounter';
import { useWonModes } from './context/WonModesContext';
import { useVJLData } from './context/VJLDataContext';
import AllModesShareBox from './components/AllModesShareBox';
import YesterdayAnswerBox from './components/YesterdayAnswerBox';

const ATTRIBUTES: { key: Exclude<keyof VJLPerson, 'id'>; label: string }[] = [
  { key: 'avatarUrl', label: 'Membre' },
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

// Contrôle de la date du puzzle (logique "Loldle")
(function checkClassicDate() {
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
  const key = 'classic_last_played';
  const lastPlayed = localStorage.getItem(key);
  if (lastPlayed && lastPlayed !== todayParis) {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('classic')) localStorage.removeItem(k);
    });
    localStorage.setItem(key, todayParis);
    window.location.reload();
  } else {
    localStorage.setItem(key, todayParis);
  }
})();

const ClassicPage: React.FC = () => {
  const [answer, setAnswer] = useState<VJLPerson | null>(null);
  const [guesses, setGuesses] = useState<number[]>([]); // Stocke les ids numériques
  const [historyCopied, setHistoryCopied] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [showVictoryBox, setShowVictoryBox] = useState(false);
  const [pendingVictory, setPendingVictory] = useState<null | { newGuesses: number[] }>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('00:00:00');
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [answerId, setAnswerId] = useState<number | null>(null);
  const [guessCounts, setGuessCounts] = useState<Record<number, number>>({});
  const [myRank, setMyRank] = useState<number | null>(null);
  const [yesterdayAnswer, setYesterdayAnswer] = useState<VJLPerson | null>(null);
  const [yesterdayAnswerId, setYesterdayAnswerId] = useState<number | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const { refreshWonModes } = useWonModes();
  const { vjlData, loading: loadingVJLData, error } = useVJLData();

  // Chargement initial depuis le backend
  useEffect(() => {
    if(loadingVJLData || error || vjlData.length === 0) return;
    let cancelled = false;
    let retryTimeout: NodeJS.Timeout | null = null;
    async function tryLoad() {
      setLoading(true);
      setMaintenance(false);
      try {
        const today = await fetchTodayFromBackend();
        const answer = await fetchAnswer(GAME_MODE, today);
        setAnswerId(answer.answerId);
        const answerObj = vjlData.find(p => p.id === answer.personId);
        setAnswer(answerObj || null);
        // Puis charge la partie
        const state = await apiLoadGame(GAME_MODE);
        setGuesses(state.guesses || []);
        setHasWon(state.hasWon || false);
        if (typeof state.rank === 'number') setMyRank(state.rank);
        // Ajout : si déjà gagné, afficher la VictoryBox
        if (state.hasWon) setShowVictoryBox(true);
        // Récupère les guessCounts
        const counts = await fetchGuessCounts(GAME_MODE);
        setGuessCounts(counts);
        // Récupère les modes gagnés
        await refreshWonModes();
        setLoading(false);
      } catch (err: any) {
        setMaintenance(true);
        setLoading(false);
        // On attend 3s puis on retente
        retryTimeout = setTimeout(() => {
          if (!cancelled) tryLoad();
        }, 3000);
      }
    }
    tryLoad();
    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [loadingVJLData, error, vjlData]);

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

  // Ajout récupération guessCounts (mock)
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

  // Récupère la réponse d'hier au chargement
  useEffect(() => {
    if (loadingVJLData || error || vjlData.length === 0) return;
    (async () => {
      const today = await fetchTodayFromBackend();
      const todayDate = new Date(today);
      const yesterday = new Date(todayDate);
      yesterday.setDate(todayDate.getDate() - 1);
      const yDate = yesterday.toISOString().slice(0, 10);
      const yAnswerData = await fetchAnswerIfExists(GAME_MODE, yDate);
      if (yAnswerData && typeof yAnswerData.personId !== 'undefined') {
        setYesterdayAnswerId(yAnswerData.answerId);
        const yAnswerObj = vjlData.find(p => p.id === yAnswerData.personId);
        setYesterdayAnswer(yAnswerObj || null);
      } else {
        setYesterdayAnswerId(null);
        setYesterdayAnswer(null);
      }
    })();
  }, [vjlData, loadingVJLData, error]);

  const handleGuess = useCallback((person: VJLPerson) => {
    setGuesses(prevGuesses => {
      if (prevGuesses.includes(person.id)) return prevGuesses;
      const newGuesses = [...prevGuesses, person.id];
      fetchGuessCounts(GAME_MODE).then(setGuessCounts);
      if (answer && person.id === answer.id) {
        setHasWon(true);
        setShowVictoryBox(false);
        setPendingVictory({ newGuesses });
      } else {
        apiSaveGame(GAME_MODE, newGuesses, false);
      }
      return newGuesses;
    });
  }, [answer, refreshWonModes]);

  // Scroll vers le VictoryBox quand il apparaît
  useEffect(() => {
    if (hasWon && showVictoryBox && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasWon, showVictoryBox]);

  // Scroll vers la victoire même après un refresh si on a gagné
  useEffect(() => {
    if (hasWon && showVictoryBox) {
      // On lance le scroll quand le DOM est prêt
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Utilise MutationObserver pour attendre que le DOM soit prêt
        const observer = new MutationObserver(() => {
          if (resultRef.current) {
            resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Clean up
        return () => observer.disconnect();
      }
    }
  }, [hasWon, showVictoryBox]);

  // Callback à passer à ClassicGuessHistory pour la fin d'animation
  const handleLineAnimationEnd = useCallback(async () => {
    if (!pendingVictory) return;
    // Enregistre la victoire et récupère le rang
    const count = await fetchWinnersCount(GAME_MODE);
    setMyRank(count + 1);
    await apiSaveGame(GAME_MODE, pendingVictory.newGuesses, true, count + 1);
    refreshWonModes();
    // Confettis
    import('./confetti').then(({ default: confetti }) => {
      window.requestAnimationFrame(() => {
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.5 },
          zIndex: 9999,
        });
      });
      setTimeout(() => {
        setShowVictoryBox(true);
      }, 1200);
    });
    setPendingVictory(null);
  }, [pendingVictory, refreshWonModes]);

  // Génération du texte d'historique à copier (reprend la logique de ClassicGuessHistory)
  // Utilise la fonction utilitaire commune
  function getShareText(): string {
    if (!answer) return '';
    return buildShareText(guesses.map(id => vjlData.find(p => p.id === id)!), answer, ATTRIBUTES, GAME_MODE, answerId ? String(answerId) : '?');
  }

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
          setMaintenance(true);
          let ready = false;
          while (!ready) {
            try {
              ready = await fetchCronReadyFromBackend();
            } catch {}
            if (!ready) await new Promise(res => setTimeout(res, 1000));
          }
          setMaintenance(false);
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
  const guessObjects = guesses.map(id => vjlData.find(p => p.id === id)).filter(Boolean) as VJLPerson[];

  // Affichage conditionnel pendant le chargement ou maintenance
  if (maintenance) {
    return <div style={{color:'#ffd700',fontWeight:600,fontSize:'1.2rem',textAlign:'center',marginTop:40}}>
      <span>Maintenance en cours…<br/>Le jeu sera disponible dès que la mise à jour quotidienne est terminée.<br/>Nouvel essai dans quelques secondes…</span>
    </div>;
  }

  if (loadingVJLData) {
    return <div>Chargement des données...</div>;
  }
  if (error) {
    return <div>Erreur de chargement des données : {error}</div>;
  }
  if (loading || !answer) {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      {/* Affiche l'input seulement si la réponse n'est pas trouvée */}
      {!hasWon && (
        <GuessInput mode={GAME_MODE} onGuess={handleGuess} />
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
      <ClassicGuessHistory
        guesses={guessObjects}
        answer={answer}
        attributes={ATTRIBUTES}
        guessCounts={guessCounts}
        onLastLineAnimationEnd={hasWon && !showVictoryBox && pendingVictory ? handleLineAnimationEnd : undefined}
      />
      <ColorIndicator />
      {hasWon && showVictoryBox && (
        <>
          <div ref={resultRef} style={{ margin: '32px 0 24px 0' }}>
            <VictoryBox
              memberIcon={answer?.avatarUrl ? `${answer.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''}
              memberName={answer?.prenom}
              attempts={guessObjects.length}
              nextMode="Citation"
              nextModeImg={'next-citation.png'}
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
          </div>
          <AllModesShareBox />
        </>
      )}
      {yesterdayAnswer && yesterdayAnswerId && (
        <YesterdayAnswerBox yesterdayAnswer={yesterdayAnswer} answerId={yesterdayAnswerId} />
      )}
      <div style={{ marginTop: 36 }} />
    </div>
  );
};

export default ClassicPage;