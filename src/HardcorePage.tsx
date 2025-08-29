import React, { useState, useCallback, useEffect } from 'react';
import CitationPage from './CitationPage';
import ImagePage from './ImagePage';
import EmojiPage from './EmojiPage';
import { fetchHardcoreLeaderboard, submitHardcoreScore, type HardcoreScore } from './api/api';
import OeilPage from './OeilPage';

const MODES = [
  { name: 'citation', component: CitationPage },
  { name: 'image', component: ImagePage },
  { name: 'emoji', component: EmojiPage },
  { name: 'oeil', component: OeilPage }
];

function getRandomMode() {
  return MODES[Math.floor(Math.random() * MODES.length)];
}

const URL = import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173';

const HardcorePage: React.FC = () => {
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [currentMode, setCurrentMode] = useState(getRandomMode());
  const [modeKey, setModeKey] = useState<string>(currentMode.name);
  const [leaderboard, setLeaderboard] = useState<HardcoreScore[]>([]);
  const [historyCopied, setHistoryCopied] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch leaderboard
  useEffect(() => {
    fetchHardcoreLeaderboard().then(setLeaderboard);
  }, [submitted, gameOver]);

  const handleWin = useCallback(() => {
    setScore(prev => prev + 1);
    // On force le changement de mode pour ne pas répéter le même deux fois de suite
    let next;
    do {
      next = getRandomMode();
    } while (next.name === modeKey && MODES.length > 1);
    setCurrentMode(next);
    setModeKey(next.name);
  }, [modeKey]);

  const handleLose = useCallback(() => {
    setGameOver(true);
    setShowNameInput(true);
  }, []);

  const handleRestart = () => {
    setScore(0);
    setGameOver(false);
    setCurrentMode(getRandomMode());
    setShowNameInput(false);
    setPlayerName('');
    setSubmitted(false);
  };

  const getHardcoreShareText = (score: number) => {
    return `J'ai fait un score de ${score} en mode Hardcore sur #ValoJundle ! ⚔️\n\n${URL}`;
  };

  // Gestion du copier (texte à partager)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getHardcoreShareText(score));
      setHistoryCopied(true);
      setTimeout(() => setHistoryCopied(false), 1800);
    } catch {
      setHistoryCopied(false);
    }
  };

  const handleSubmitScore = async () => {
    if (!playerName.trim()) return;
    setSubmitting(true);
    try {
      await submitHardcoreScore(playerName.trim(), score);
      setSubmitted(true);
      setShowNameInput(false);
      setPlayerName('');
    } catch {}
    setSubmitting(false);
  };

  // Leaderboard display
  const handleDownloadLeaderboard = () => {
    // Format leaderboard as plain text
    let text = '🏆 Leaderboard Hardcore\n';
    leaderboard.forEach((entry, i) => {
      text += `${i + 1}. ${entry.name} — ${entry.score} pts (${new Date(entry.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })})\n`;
    });
    if (leaderboard.length === 0) {
      text += 'Aucun score enregistré\n';
    }
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "valojundle_hardcore_leaderboard.txt");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const renderLeaderboard = () => (
    <div style={{ maxWidth: 400, margin: '30px auto 30px auto', background: '#222', color: '#fff', borderRadius: 8, padding: 16 }}>
      <h3>🏆 Leaderboard Hardcore</h3>
      <ol style={{ paddingLeft: 20 }}>
        {leaderboard.slice(0, 10).map((entry, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <b>{entry.name}</b> — {entry.score} pts <span style={{ fontSize: 12, color: '#aaa' }}>({new Date(entry.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })})</span>
          </li>
        ))}
        {leaderboard.length > 10 && (
          <li key="more" style={{ color: '#aaa', textAlign: 'center', listStyle: 'none' }}>...</li>
        )}
        {leaderboard.length === 0 && <li>Aucun score enregistré</li>}
      </ol>
      {leaderboard.length > 10 && (
        <button onClick={handleDownloadLeaderboard} style={{ marginTop: 10 }}>
          Télécharger le leaderboard complet
        </button>
      )}
    </div>
  );

  if (gameOver) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2>Game Over !</h2>
        <p>Votre score : <b>{score}</b></p>
        {showNameInput && !submitted && (
          <div style={{ margin: '20px 0' }}>
            <input
              type="text"
              placeholder="Votre nom ou pseudo"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc', marginBottom: 24 }}
              disabled={submitting}
            />
            <div>        
                <button onClick={handleSubmitScore} disabled={submitting || !playerName.trim()}>
                {submitting ? 'Envoi...' : 'Envoyer le score'}
                </button>
            </div>
            <div className="victory-history-box" style={{ marginBottom: 24 }}>
                <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', fontSize: '1.08rem', marginBottom: 8 }}>{getHardcoreShareText(score)}</div>
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
        )}
        <button onClick={handleRestart} style={{ marginLeft: 10 }}>Rejouer</button>
        {renderLeaderboard()}
      </div>
    );
  }

  const ModeComponent = currentMode.component;
  return (
    <div>
      <h2>Mode Hardcore</h2>
      <p>Score actuel : {score}</p>
      {/* On force le remount du composant uniquement quand le mode change */}
      {!gameOver && (
        <ModeComponent key={modeKey} onWin={handleWin} onLose={handleLose} hardcore />
      )}
      {renderLeaderboard()}
    </div>
  );
};

export default HardcorePage;
