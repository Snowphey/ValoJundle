import React from "react";
import { useNavigate } from "react-router-dom";
import "./VictoryBox.css";
import GameModeSelector from "../GameModeSelector";

interface VictoryBoxProps {
  memberIcon: string; // chemin de l'icône/photo
  memberName: string;
  attempts: number;
  nextMode: string;
  nextModeImg: string;
  countdown: string;
  timezone: string;
  historyText: string;
  onCopy: () => void;
  wonModes?: string[]; // Ajout de la prop pour les modes gagnés
}

const VictoryBox: React.FC<VictoryBoxProps> = ({
  memberIcon,
  memberName,
  attempts,
  nextMode,
  nextModeImg,
  countdown,
  timezone,
  historyText,
  onCopy,
  wonModes = [], // Par défaut vide
}) => {
  const navigate = useNavigate();

  return (
    <div className="victory-box-gradient">
      <div className="victory-header">VICTOIRE !</div>
      <div className="victory-member-row">
        <img src={memberIcon} alt={memberName} className="victory-member-icon" />
        <div className="victory-member-text">
          <div>Tu as trouvé</div>
          <div className="victory-member-name">{memberName}</div>
        </div>
      </div>
      <div className="victory-attempts">Nombre d'essais : <span style={{color: "#09cae6"}}>{attempts}</span></div>
      <div className="victory-next">Le prochain membre est dans</div>
      <div className="victory-countdown">{countdown}</div>
      <div className="victory-timezone">Fuseau horaire : {timezone}</div>
      <div className="victory-separator" />
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
            Citation<br />Avec une citation du Discord
          </div>
        </div>
        {/* Rope et logos des modes ici, à compléter selon assets */}
      </div>
      <div className="victory-game-mode-selector">
        <GameModeSelector wonModes={wonModes} />
      </div>
    </div>
    // Boîte d'historique en dessous
  );
};

export default VictoryBox;
