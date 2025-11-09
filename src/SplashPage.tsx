import React, { useState, useEffect, useCallback, useRef } from 'react';
import GuessInput from './components/GuessInput';
import './ValoJundleTheme.css';
import type { VJLPerson } from './types/VJLPerson';
import VictoryBox from './components/VictoryBox';
import { useWonModes } from './context/WonModesContext';
import { useVJLData } from './context/VJLDataContext';
import GuessHistory from './components/GuessHistory';
import { buildShareText } from './utils/buildShareText';
import { loadGame as apiLoadGame, saveGame as apiSaveGame, fetchSplashOfTheDay, fetchGuessCounts, fetchWinnersCount, fetchTodayFromBackend, fetchAnswerIfExists, fetchRandomSplash, fetchAnswer, fetchCronReadyFromBackend } from './api/api';
import AllModesShareBox from './components/AllModesShareBox';
import AnimatedCounter from './components/AnimatedCounter';
import YesterdayAnswerBox from './components/YesterdayAnswerBox';

const GAME_MODE = 'splash';

interface SplashPageProps {
  onWin?: () => void;
  onLose?: () => void;
  hardcore?: boolean;
}

const ZOOM_STEPS = 10;

const SplashPage: React.FC<SplashPageProps> = ({ onWin, onLose, hardcore }) => {
    const [answer, setAnswer] = useState<VJLPerson | null>(null);
    const [answerId, setAnswerId] = useState<number | null>(null);
    const [guesses, setGuesses] = useState<number[]>([]);
    const [hasWon, setHasWon] = useState(false);
    const [showVictoryBox, setShowVictoryBox] = useState(false);
    const [winnersCount, setWinnersCount] = useState<number>(0);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [guessCounts, setGuessCounts] = useState<Record<number, number>>({});
    const [lastWrongId, setLastWrongId] = useState<number | undefined>(undefined);
    const [lastCorrectId, setLastCorrectId] = useState<number | undefined>(undefined);
    const [countdown, setCountdown] = useState('00:00:00');
    const [yesterdayAnswer, setYesterdayAnswer] = useState<VJLPerson | null>(null);
    const [yesterdayAnswerId, setYesterdayAnswerId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [maintenance, setMaintenance] = useState(false);
    const [splash, setSplash] = useState<string>("");
    const [startCoords, setStartCoords] = useState<{ x: number, y: number, zoom: number } | null>(null);
    const { refreshWonModes } = useWonModes();
    const resultRef = useRef<HTMLDivElement>(null);
    const [historyCopied, setHistoryCopied] = useState(false);
    const [zoomLocked, setZoomLocked] = useState(false);
  const { vjlData, loading: loadingVJLData, error } = useVJLData();

  // Chargement initial
  useEffect(() => {
    if (loadingVJLData || error || vjlData.length === 0) return;
    let cancelled = false;
    let retryTimeout: NodeJS.Timeout | null = null;
    async function load() {
    setLoading(true);
    setMaintenance(false);
    try {
      if (hardcore) {
      // Splash aléatoire
      const data = await fetchRandomSplash();
      setAnswer(data.person || null);
      setSplash(data.person.avatarUrl || '');
      setStartCoords(data.startCoords || null);
      setGuesses([]);
      setHasWon(false);
      setShowVictoryBox(false);
      setGuessCounts({});
      setLoading(false);
      return;
      }
      const today = await fetchTodayFromBackend();
      const answerData = await fetchAnswer(GAME_MODE, today);
      setAnswerId(answerData.answerId);
      const answerObj = vjlData.find(p => p.id == answerData.personId);
      setAnswer(answerObj || null);

      // Ajout récupération splash du jour
      if (answerObj && answerObj.discordUserId) {
        const splashData = await fetchSplashOfTheDay(answerObj.discordUserId);
        setSplash(splashData.person.avatarUrl || '');
        setStartCoords(splashData.startCoords || null);
      } else {
        setSplash('');
        setStartCoords(null);
      }
      const state = await apiLoadGame(GAME_MODE);
      setGuesses(state.guesses || []);
      setHasWon(state.hasWon || false);
      if (typeof state.rank === 'number') setMyRank(state.rank);
      if (state.hasWon) setShowVictoryBox(true);
      const counts = await fetchGuessCounts(GAME_MODE);
      setGuessCounts(counts);
      await refreshWonModes();
      setLoading(false);
    } catch (err) {
      setMaintenance(true);
      setLoading(false);
      retryTimeout = setTimeout(() => {
      if (!cancelled) load();
      }, 3000);
    }
    }
    load();
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
    
      // Gestion du guess
      const handleGuess = useCallback((person: VJLPerson) => {
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
    
      // Génère le texte à partager
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
          if (resultRef.current) {
            resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            const observer = new MutationObserver(() => {
              if (resultRef.current) {
                resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                observer.disconnect();
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            return () => observer.disconnect();
          }
        }
      }, [hasWon, showVictoryBox]);

    // Calcule le zoom courant en fonction du nombre d'essais
    function getCurrentZoom() {
        if (!startCoords) return 1;
        if (zoomLocked) return startCoords.zoom;
        const step = Math.min(guesses.length, ZOOM_STEPS - 1);
        // Interpolation linéaire du zoom
        return startCoords.zoom - (startCoords.zoom - 1) * (step / (ZOOM_STEPS - 1));
    }

  if (maintenance) {
    return <div style={{color:'#ffd700',fontWeight:600,fontSize:'1.2rem',textAlign:'center',marginTop:40}}>
      <span>Maintenance en cours…<br/>Le jeu sera disponible dès que la mise à jour quotidienne est terminée.<br/>Nouvel essai dans quelques secondes…</span>
    </div>;
  }
  if (loadingVJLData) return <div>Chargement des données...</div>;
  if (error) return <div>Erreur de chargement des données : {error}</div>;
  if (loading || !answer) return <div>Chargement...</div>;

  return (
    <div>
      {/* Splash box */}
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
        <div style={{ fontSize: '1.25rem', marginBottom: 8, fontWeight: 700 }}>Quel membre a l'avatar complet ?</div>
        <div style={{width:256, height:256, borderRadius:12, overflow:'hidden', display:'inline-block', background:'#222', boxShadow:'0 2px 8px #0007'}}>
          <img
            src={splash}
            alt="Splash du jour"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => { if ((e as React.MouseEvent).button === 1) (e as React.MouseEvent).preventDefault(); }}
            onAuxClick={(e) => { if ((e as React.MouseEvent).button === 1) (e as React.MouseEvent).preventDefault(); }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'grayscale(1)',
              borderRadius: 12,
              transition: 'transform 0.5s cubic-bezier(.4,1,.6,1), filter 0.3s',
              transform: startCoords ? (() => {
                const zoom = getCurrentZoom();
                const x = startCoords.x;
                const y = startCoords.y;
                const translateX = (0.5 - x) * 100;
                const translateY = (0.5 - y) * 100;
                return `scale(${zoom}) translate(${translateX / zoom}%, ${translateY / zoom}%)`;
              })() : 'none',
              background: '#222',
            }}
          />
        </div>
        {/* Bouton de zoom (remplacé par une image cliquable) */}
        <div style={{marginTop: 12, marginBottom: 12}}>
          <img
            src={zoomLocked ? 'zoomlocked.png' : 'zoom.png'}
            alt={zoomLocked ? 'Zoom verrouillé' : 'Zoom'}
            style={{
              width: 57,
              cursor: 'pointer',
              transition: 'width .2s ease, filter 0.2s',
              filter: zoomLocked ? 'grayscale(0.5)' : 'none',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
            onClick={() => setZoomLocked(z => !z)}
            onMouseEnter={e => { e.currentTarget.style.width = '60px'; }}
            onMouseLeave={e => { e.currentTarget.style.width = '57px'; }}
          />
        </div>
        {/* Phrase d'aide */}
        {!zoomLocked && (
          <div style={{fontSize: '0.92rem', color: '#aaa', marginBottom: 2}}>
            Chaque essai dézoome un peu.
          </div>
        )}
      </div>

      {!hasWon && (
        <GuessInput mode={GAME_MODE} onGuess={handleGuess} hardcore={hardcore} />
      )}
      {/* Compteur de gagnants */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
        <span style={{ color: '#f2ff7d', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 }}>
          <AnimatedCounter value={winnersCount} direction="up" />
        </span>
        <span style={{ color: '#fff', fontWeight: 500, fontSize: '1.1rem', marginLeft: 6 }}>
          {winnersCount > 1 ? 'personnes ont' : 'personne a'} trouvé !
        </span>
      </div>
      {/* Historique des guesses façon splash */}
      <GuessHistory 
        guesses={guessObjects} 
        guessCounts={guessCounts} 
        lastWrongId={lastWrongId}
        lastCorrectId={lastCorrectId}
        answerId={answer?.id}
        hardcore={hardcore}
      />
      <div style={{ marginTop: 36 }} />
      {/* Victoire */}
      {hasWon && showVictoryBox && (
        <div ref={resultRef} style={{ margin: '32px 0 24px 0' }}>
          <VictoryBox 
            memberIcon={answer?.avatarUrl ? `${answer.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''} 
            memberName={answer?.prenom ?? ''} 
            attempts={guessObjects.length} 
            nextMode="Oeil"
            nextModeImg={'next-oeil.png'}
            countdown={countdown} 
            timezone="Europe/Paris (UTC+2)" 
            rank={myRank} 
            splashImg={splash}
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
        <YesterdayAnswerBox yesterdayAnswer={yesterdayAnswer} answerId={yesterdayAnswerId ?? undefined} />
      )}
    </div>
  );
};

export default SplashPage;
