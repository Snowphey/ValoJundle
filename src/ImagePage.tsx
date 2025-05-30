import React from "react";
import { useNavigate } from "react-router-dom";
import './ValoJundleTheme.css';

const ImagePage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(24,28,36,0.92)',
      borderRadius: 18,
      border: '2px solid #af9767',
      boxShadow: '0 2px 16px #000a',
      padding: '48px 18px 36px 18px',
      margin: '40px auto',
      maxWidth: 540,
      color: '#fff',
      textAlign: 'center',
      fontFamily: 'Friz Quadrata Std, Mobilo, Helvetica, Arial, sans-serif',
    }}>
      <img src="/image.png" alt="Mode Image" style={{ width: 90, marginBottom: 24 }} />
      <div style={{ fontSize: '2.1rem', fontWeight: 700, marginBottom: 12 }}>Mode Image</div>
      <div style={{ fontSize: '1.2rem', marginBottom: 18 }}>
        Ce mode arrive bientôt !<br />
        Devine le membre à partir d'une image du Discord.
      </div>
      <button
        onClick={() => navigate('/')}
        style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: 16,
          borderRadius: 8,
          padding: '10px 28px',
          textDecoration: 'none',
          boxShadow: '0 2px 8px #0005',
          border: 'none',
          marginTop: 18,
          cursor: 'pointer',
          transition: 'filter 0.15s',
        }}
        onMouseOver={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
        onMouseOut={e => (e.currentTarget.style.filter = '')}
      >
        Retour à l'accueil
      </button>
    </div>
  );
};

export default ImagePage;
