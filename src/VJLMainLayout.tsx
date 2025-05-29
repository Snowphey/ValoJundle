import { Outlet } from 'react-router-dom';
import './ValoJundleTheme.css';
import GameModeSelector from './GameModeSelector';

const VJLMainLayout: React.FC = () => {
  return (
    <div className="valojundle-bg">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16 }}>
        <img src={'valojundle logo.png'} alt="ValoJundle Logo" style={{ height: 128 }} />
      </div>
      <div style={{marginBottom: 24}}>
        <GameModeSelector />
      </div>
      <div className="vjl-content">
        <Outlet />
      </div>
    </div>
  );
};

export default VJLMainLayout;
