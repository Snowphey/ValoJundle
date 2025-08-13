import React from 'react';
import modes from '../data/modes.json';
import { useWonModes } from '../context/WonModesContext';
import { loadGame } from '../api/api';

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

  // On exclut le mode "hardcore" des modes à valider et à afficher
  const shareableModes = modes.filter(m => m.key !== 'hardcore');

  // Affiche uniquement si tous les modes (hors hardcore) sont validés (ordre et exhaustivité)
  const allModesWon = shareableModes.every(m => wonModes.includes(m.key)) && shareableModes.length === wonModes.length;
  if (!allModesWon) return null;

  // Ajout de l'emoji 🤯 si 1 coup dans le résumé global
  const oneShotEmoji = '🤯';

  const shareText = [
    `J'ai complété tous les modes de #ValoJundle aujourd'hui :`,
    ...shareableModes.map(mode => {
      const triesCount = tries[mode.key] ?? '?';
      let suffix = '';
      if (triesCount === 1) suffix = ` ${oneShotEmoji}`;
      return `${mode.emoji || ''} ${mode.label} : ${triesCount}${suffix}`;
    }),
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
