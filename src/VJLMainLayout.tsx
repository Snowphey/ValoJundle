import { Outlet } from 'react-router-dom';
import './ValoJundleTheme.css';
import GameModeSelector from './GameModeSelector';
import { useWonModes } from './WonModesContext';

const VJLMainLayout: React.FC = () => {
  const { wonModes } = useWonModes();

  return (
    <div className="valojundle-bg">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16 }}>
        <img src={'valojundle logo.png'} alt="ValoJundle Logo" style={{ height: 128 }} />
      </div>
      <div style={{marginBottom: 24}}>
        <GameModeSelector wonModes={wonModes} />
      </div>
      <div className="vjl-content">
        <Outlet />
      </div>
    </div>
  );
};

export default VJLMainLayout;
