import React from 'react';
import type { VJLPerson } from '../types/VJLPerson';

interface YesterdayAnswerBoxProps {
  yesterdayAnswer: VJLPerson;
  answerId: number; // Optionnel, pour afficher le numéro de partie
}

const YesterdayAnswerBox: React.FC<YesterdayAnswerBoxProps> = ({ yesterdayAnswer, answerId }) => {
  return (
    <div style={{
      fontFamily: 'Friz Quadrata Std, Mobilo, Helvetica, Arial, sans-serif',
      textAlign: 'center',
      fontSize: '1.2rem',
    }}>
      <div>
        Le membre d'hier était{' '}
        <span style={{color:'#4da6ff',fontWeight:700}}>
            #{answerId}
        </span>
        <img src={yesterdayAnswer.avatarUrl || ''} alt={yesterdayAnswer.prenom} width={32} height={32} style={{borderRadius: 8, verticalAlign:'middle',margin:'0 6px',objectFit:'cover',background:'#222'}} />
        <span style={{color:'#7fff7f',fontWeight:700}}>{yesterdayAnswer.prenom}</span>
      </div>
    </div>
  );
};

export default YesterdayAnswerBox;
