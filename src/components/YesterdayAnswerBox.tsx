import React from 'react';
import type { VJLPerson } from '../types/VJLPerson';

interface YesterdayAnswerBoxProps {
  yesterdayAnswer: VJLPerson;
  gameId: number; // Optionnel, pour afficher le numéro de partie
}

const YesterdayAnswerBox: React.FC<YesterdayAnswerBoxProps> = ({ yesterdayAnswer, gameId }) => {
  return (
    <div style={{
      fontFamily: 'Friz Quadrata Std, Mobilo, Helvetica, Arial, sans-serif',
      textAlign: 'center',
      fontSize: '1.2rem',
    }}>
      <div>
        Le membre d'hier était{' '}
        <span style={{color:'#4da6ff',fontWeight:700}}>
            #{gameId}
        </span>
        <img src={'pfps/' + yesterdayAnswer.pfp} alt="" width={32} height={32} style={{borderRadius:8,verticalAlign:'middle',margin:'0 6px'}} />
        <span style={{color:'#7fff7f',fontWeight:700}}>{yesterdayAnswer.prenom}</span>
      </div>
    </div>
  );
};

export default YesterdayAnswerBox;
