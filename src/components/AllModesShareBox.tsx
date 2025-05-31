import React from 'react';
import modes from '../data/modes.json';
import { useWonModes } from '../WonModesContext';
import { loadGame } from '../api/api';

const MODE_ICONS: Record<string, string> = {
  classic: '❓',
  citation: '💬',
  image: '🖼️',
};

const MODE_LABELS: Record<string, string> = Object.fromEntries(modes.map(m => [m.key, m.label]));

const AllModesShareBox: React.FC = () => {
  const { wonModes } = useWonModes();
  const [tries, setTries] = React.useState<Record<string, number>>({});
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const result: Record<string, number> = {};
      for (const mode of modes) {
        if (wonModes.includes(mode.key)) {
          const game = await loadGame(mode.key);
          result[mode.key] = Array.isArray(game.guesses) ? game.guesses.length : 0;
        }
      }
      setTries(result);
    })();
  }, [wonModes]);

  // Affiche uniquement si tous les modes sont validés (ordre et exhaustivité)
  const allModesWon = modes.every(m => wonModes.includes(m.key)) && wonModes.length === modes.length;
  if (!allModesWon) return null;

  const shareText = [
    `J'ai complété tous les modes de #ValoJundle aujourd'hui :`,
    ...modes.map(mode => `${MODE_ICONS[mode.key] || ''} ${MODE_LABELS[mode.key]}: ${tries[mode.key] ?? '?'}`),
    '',
    import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173',
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="victory-history-box" style={{ margin: '32px auto', maxWidth: 500 }}>
      <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', fontSize: '1.08rem', marginBottom: 8 }}>{shareText}</div>
      <button className="victory-history-copy-btn" onClick={handleCopy} type="button">
        <span style={{display:'flex',alignItems:'center',gap:6}}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}} xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="3" width="12" height="14" rx="3" fill={copied ? '#ffd700' : '#e6c559'} stroke="#3a2e14" strokeWidth="1.5"/>
            <rect x="2" y="6" width="12" height="11" rx="2.5" fill="none" stroke="#bfa23a" strokeWidth="1.2"/>
          </svg>
          {copied ? 'Copié !' : 'Copier'}
        </span>
      </button>
    </div>
  );
};

export default AllModesShareBox;
