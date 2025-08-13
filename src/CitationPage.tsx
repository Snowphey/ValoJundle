import React, { useState, useEffect, useCallback } from 'react';
import GuessInput from './components/GuessInput';
import './ValoJundleTheme.css';
import type { VJLPerson } from './types/VJLPerson';
import VictoryBox from './components/VictoryBox';
import AnimatedCounter from './components/AnimatedCounter';
import { useWonModes } from './context/WonModesContext';
import { useVJLData } from './context/VJLDataContext';
import GuessHistory from './components/GuessHistory';
import { buildShareText } from './utils/buildShareText';
import { loadGame as apiLoadGame, saveGame as apiSaveGame, fetchAnswer, fetchAnswerIfExists, fetchWinnersCount, fetchTodayFromBackend, fetchCitationOfTheDay, fetchGuessCounts, fetchCronReadyFromBackend, fetchRandomCitation } from './api/api';
import AllModesShareBox from './components/AllModesShareBox';
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

interface CitationPageProps {
  onWin?: () => void;
  onLose?: () => void;
  hardcore?: boolean;
}

const CitationPage: React.FC<CitationPageProps> = ({ onWin, onLose, hardcore }) => {
  const [answer, setAnswer] = useState<VJLPerson | null>(null);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [hasWon, setHasWon] = useState(false);
  const [historyCopied, setHistoryCopied] = useState(false);
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [answerId, setAnswerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('00:00:00');
  const resultRef = React.useRef<HTMLDivElement>(null);
  const { refreshWonModes } = useWonModes();
  const [mainMessage, setMainMessage] = useState<any | null>(null);
  const [guessCounts, setGuessCounts] = useState<Record<number, number>>({});
  const [lastWrongId, setLastWrongId] = useState<number | undefined>(undefined);
  const [lastCorrectId, setLastCorrectId] = useState<number | undefined>(undefined);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [yesterdayAnswer, setYesterdayAnswer] = useState<VJLPerson | null>(null);
  const [yesterdayAnswerId, setYesterdayAnswerId] = useState<number | null>(null);
  const [showVictoryBox, setShowVictoryBox] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const { vjlData, loading: loadingVJLData, error } = useVJLData();

  // Chargement initial depuis le backend
  useEffect(() => {
    if (loadingVJLData || error || vjlData.length === 0) return;
    let cancelled = false;
    let retryTimeout: NodeJS.Timeout | null = null;
    async function tryLoad() {
      setLoading(true);
      setMaintenance(false);
      try {
        if (hardcore) {
          // Citation aléatoire
          const data = await fetchRandomCitation();
          setAnswer(data.person || null);
          setMainMessage(data.message || null);
          setGuesses([]);
          setHasWon(false);
          setShowVictoryBox(false);
          setGuessCounts({});
          setLoading(false);
          return;
        }
        const today = await fetchTodayFromBackend();
        const answer = await fetchAnswer(GAME_MODE, today);
        setAnswerId(answer.answerId);
        const answerObj = vjlData.find(p => p.id == answer.personId);
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
  }, [hardcore, refreshWonModes, vjlData, loadingVJLData, error]);

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
  const handleGuess = useCallback(async (person: VJLPerson) => {
    setGuesses(prevGuesses => {
      if (prevGuesses.includes(person.id)) return prevGuesses;
      const newGuesses = [...prevGuesses, person.id];
      fetchGuessCounts(GAME_MODE).then(setGuessCounts);
      if (answer && person.id === answer.id) {
        setLastCorrectId(person.id);
        setHasWon(true);
        setShowVictoryBox(false);
        setTimeout(async () => {
          if (hardcore && onWin) {
            onWin();
          } else {
            // Enregistre la victoire et récupère le rang
            const count = await fetchWinnersCount(GAME_MODE);
            setMyRank(count + 1);
            await apiSaveGame(GAME_MODE, newGuesses, true, count + 1);
            refreshWonModes();
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
          }
        }, 600);
      } else {
        setLastWrongId(person.id);
        if (hardcore && onLose) {
          onLose();
        } else {
          apiSaveGame(GAME_MODE, newGuesses, false);
        }
      }
      return newGuesses;
    });
  }, [answer, onWin, onLose, hardcore, refreshWonModes]);

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
            if (!ready) await new Promise(res => setTimeout(res, 3000));
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
    return buildShareText(guessObjects, answer, [], GAME_MODE, answerId?.toString() ?? '?');
  }

  // Pour l'affichage des guesses
  const guessObjects = guesses.map(id => vjlData.find(p => p.id == id)).filter(Boolean) as VJLPerson[];

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
        const yAnswerObj = vjlData.find(p => p.id == yAnswerData.personId);
        setYesterdayAnswer(yAnswerObj || null);
      } else {
        setYesterdayAnswerId(null);
        setYesterdayAnswer(null);
      }
    })();
  }, [vjlData, loadingVJLData, error]);

  // Scroll vers la victoire
  useEffect(() => {
    if (showVictoryBox && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showVictoryBox]);

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

  if (maintenance) {
    return <div style={{color:'#ffd700',fontWeight:600,fontSize:'1.2rem',textAlign:'center',marginTop:40}}>
      <span>Maintenance en cours…<br/>Le jeu sera disponible dès que la mise à jour quotidienne est terminée.<br/>Nouvel essai dans quelques secondes…</span>
    </div>;
  }
  if (loadingVJLData) return <div>Chargement des données...</div>;
  if (error) return <div>Erreur de chargement des données : {error}</div>;
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
          {/* Affichage de la citation avec rendu des émojis custom Discord */}
          “ <span dangerouslySetInnerHTML={{ __html: renderDiscordEmojis(mainMessage.content) }} /> ”
        </div>
      </div>
      {/* Input de guess */}
      {!hasWon && (
        <GuessInput mode={GAME_MODE} onGuess={handleGuess} hardcore={hardcore} />
      )}
      {/* Compteur de gagnants (mocké) */}
      {!hardcore && (
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
          <span style={{ color: '#f2ff7d', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 }}>
            <AnimatedCounter value={winnersCount} direction="up" />
          </span>
          <span style={{ color: '#fff', fontWeight: 500, fontSize: '1.1rem', marginLeft: 6 }}>
            {winnersCount > 1 ? 'personnes ont' : 'personne a'} trouvé !
          </span>
        </div>
      )}
      {/* Historique des guesses façon citation */}
      <GuessHistory 
        guesses={guessObjects} 
        guessCounts={guessCounts} 
        lastWrongId={lastWrongId}
        lastCorrectId={lastCorrectId}
        answerId={answer.id}
        hardcore={hardcore}
      />
      <div style={{ marginTop: 36 }} />
      {/* Victoire */}
      {(!hardcore && hasWon && showVictoryBox) && (
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
            memberIcon={answer?.avatarUrl ? `${answer.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''}
            memberName={answer?.prenom}
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
      {yesterdayAnswer && yesterdayAnswerId && !hardcore && (
        <YesterdayAnswerBox yesterdayAnswer={yesterdayAnswer} answerId={yesterdayAnswerId} />
      )}
    </div>
  );
};

// Fonction utilitaire pour rendre les émojis custom Discord dans le texte
function renderDiscordEmojis(text: string): string {
  if (!text) return '';
  // Remplace les blocs de code markdown ```...```
  let replaced = text.replace(/```([\s\S]*?)```/g, (_match, code) => {
    // On échappe le HTML dans le bloc code
    const escaped = code.replace(/[&<>]/g, (c: string) => {
      if (c === '&') return '&amp;';
      if (c === '<') return '&lt;';
      if (c === '>') return '&gt;';
      return c;
    });
    // Style visuel pour le bloc code Discord
    return `<pre class=\"discord-code-block\">${escaped}</pre>`;
  });
  // Remplace les émojis custom par des balises <img>
  replaced = replaced.replace(/<a?:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) => {
    const isAnimated = match.startsWith('<a:');
    const ext = isAnimated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
    return `<img src=\"${url}\" alt=\":${name}:\" style=\"height:1.2em;vertical-align:-0.2em;\" />`;
  });
  // Word wrap intelligent (ne coupe pas les mots)
  replaced = replaced.replace(/([^\n]{60,}?)(\s|$)/g, (line) => {
    // Si la ligne est trop longue, on coupe au dernier espace avant 60 caractères
    if (line.length > 70) {
      let idx = line.lastIndexOf(' ', 70);
      if (idx === -1) idx = 70;
      return line.slice(0, idx) + '\n' + line.slice(idx + 1);
    }
    return line;
  });
  return replaced;
}
// Ajoute le style pour le bloc code Discord
const style = document.createElement('style');
style.innerHTML = `
.discord-code-block {
  background: #23272a;
  color: #e6e6e6;
  font-family: 'Consolas', 'Menlo', 'Monaco', 'Liberation Mono', 'Courier New', monospace;
  border-radius: 7px;
  padding: 10px 14px;
  margin: 8px 0;
  font-size: 1.05em;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-width: 100%;
}
`;
document.head.appendChild(style);

export default CitationPage;
