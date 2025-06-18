import React from "react";
import { useNavigate } from "react-router-dom";
import "./VictoryBox.css";
import GameModeSelector from "../GameModeSelector";
import AnimatedCounter from "./AnimatedCounter";

interface VictoryBoxProps {
  memberIcon: string; // chemin de l'icône/photo
  memberName: string;
  attempts: number;
  nextMode: string | null; // peut être null si pas de mode suivant
  nextModeImg: string | null; // chemin de l'image du mode suivant, peut être null
  countdown: string;
  timezone: string;
  rank?: number | null; // Ajout du rang
}

const VictoryBox: React.FC<VictoryBoxProps> = ({
  memberIcon,
  memberName,
  attempts,
  nextMode,
  nextModeImg,
  countdown,
  timezone,
  rank,
}) => {
  const navigate = useNavigate();

  // Liste de textes de victoire
  const victoryTexts = [
    "VICTOIRE !",
    "gg wp",
    "ez",
    "Point faible : trop fort !",
    "Masterclass !",
    "Tu serais pas Adrien ? Parce que tu es le boss...",
    "Carré dans l'axe !",
    "C'est du propre !"
  ];
  // Choix aléatoire une seule fois au montage
  const [victoryText] = React.useState(() => victoryTexts[Math.floor(Math.random() * victoryTexts.length)]);

  return (
    <div className="victory-box-gradient">
      <div className="victory-header">{victoryText}</div>
      <div className="victory-member-row">
        <img src={memberIcon} alt={memberName} className="victory-member-icon" />
        <div className="victory-member-text">
          <div>Tu as trouvé</div>
          <div className="victory-member-name">{memberName}</div>
        </div>
      </div>
      {/* Affiche le rang sous le membre et au-dessus du nombre d'essais */}
      {typeof rank === 'number' && (
        <div style={{
          textAlign: 'center',
          margin: '12px 0 8px 0',
          fontWeight: 600,
          fontSize: '1rem',
          color: '#fff',
          letterSpacing: 0.5,
        }}>
          Tu es le n°<span style={{color:'#09cae6'}}>{rank}</span> à avoir trouvé le membre du jour.
        </div>
      )}
      <div className="victory-attempts">Nombre d'essais : <span style={{color: "#09cae6"}}>{attempts}</span></div>
      <div className="victory-next">Le prochain membre est dans</div>
      <div className="victory-countdown">
        {/* Utilise 6 AnimatedCounter pour chaque chiffre du countdown */}
        {countdown.split('').map((char, idx) =>
          char === ':' ? (
            <span key={idx} style={{ display: 'inline-block', width: '0.7ch', textAlign: 'center' }}>:</span>
          ) : (
            <AnimatedCounter
              key={idx}
              value={parseInt(char, 10)}
              direction="down"
              duration={500}
              color="#fff"
              fontSize="1.5rem"
            />
          )
        )}
      </div>
      <div className="victory-timezone">Fuseau horaire : {timezone}</div>
      <div className="victory-separator" />
      {nextMode && nextModeImg ? (
        <div className="victory-next-mode">
          <div className="victory-next-mode-label">Mode suivant :</div>
          <div className="victory-next-mode-row">
            <div
              className="victory-next-mode-img-container"
              onClick={() => navigate(`/${nextMode.toLowerCase()}`)}
              tabIndex={0}
              role="button"
              aria-label={`Aller au mode ${nextMode}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/${nextMode.toLowerCase()}`);
              }}
            >
              <img src={nextModeImg} alt={nextMode} className="victory-next-mode-img" />
              <div className="victory-next-mode-overlay">
                {nextMode.toLowerCase() === 'citation' ? (
                  <>Citation<br />Avec une citation du Discord</>
                ) : nextMode.toLowerCase() === 'image' ? (
                  <>Image<br />Avec une image du Discord</>
                ) : nextMode.toLowerCase() === 'emoji' ? (
                  <>Emoji<br />Avec des emojis de quelqu'un</>
                ) : (
                  nextMode
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="victory-game-mode-selector">
        <GameModeSelector />
      </div>
    </div>
    // Boîte d'historique en dessous
  );
};

export default VictoryBox;
