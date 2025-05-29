import type { VJLPerson } from '../types/VJLPerson';
import type { CardStatus } from '../components/CardColumn';

export interface Attribute {
  key: keyof VJLPerson;
  label: string;
}

const URL = import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173';

export function buildShareText(
  guesses: VJLPerson[],
  answer: VJLPerson,
  attributes: Attribute[],
  mode: string = 'classique',
  gameNumber: string = '?'
): string {
  if (!guesses.length) return '';
  const tries = guesses.length;
  let text = `J'ai trouvé le membre #ValoJundle #${gameNumber} en mode ${mode} en ${tries} coup${tries > 1 ? "s" : ""}  ⚔️\n`;
  const colorMap: Record<string, string> = {
    correct: '🟩',
    partial: '🟧',
    incorrect: '🟥',
    higher: '⬆️',
    lower: '⬇️',
  };
  const getStatusEmoji = (status: CardStatus) => colorMap[status] || '⬛';
  const shareAttributes = attributes.filter(attr => attr.key !== 'pfp');
  // getStatus logic must be provided by the caller or re-implemented here
  const getStatus = (guess: VJLPerson, answer: VJLPerson, key: keyof VJLPerson): CardStatus => {
    if (key === 'height') {
      const guessRounded = Math.round(guess.height / 10) * 10;
      const answerRounded = Math.round(answer.height / 10) * 10;
      if (guessRounded === answerRounded) return 'correct';
      if (guessRounded < answerRounded) return 'higher';
      return 'lower';
    }
    if (key === 'birthDate') {
      if (guess.birthDate === answer.birthDate) return 'correct';
      if (guess.birthDate < answer.birthDate) return 'higher';
      return 'lower';
    }
    if (Array.isArray(guess[key]) && Array.isArray(answer[key])) {
      return (guess[key] as string[]).some(val => (answer[key] as string[]).includes(val)) ?
        ((guess[key] as string[]).join() === (answer[key] as string[]).join() ? 'correct' : 'partial') : 'incorrect';
    }
    if (guess[key] === answer[key]) return 'correct';
    if (
      typeof guess[key] === 'string' &&
      typeof answer[key] === 'string' &&
      guess[key] && answer[key] &&
      (guess[key] as string).toLowerCase().includes((answer[key] as string).toLowerCase())
    ) return 'partial';
    return 'incorrect';
  };
  // Affiche les 5 derniers guesses (ou moins) et indique s'il y en a plus
  const displayedGuesses = guesses.slice(-5).reverse();
  displayedGuesses.forEach(guess => {
    const row = shareAttributes.map(attr => {
      const status = getStatus(guess, answer, attr.key);
      return getStatusEmoji(status);
    }).join('');
    text += row + '\n';
  });
  if (guesses.length > 5) {
    // Mappe les chiffres en émojis et le + aussi
    const numberToEmoji = (n: number) => n.toString().split('').map(digit => {
      const emojiDigits: Record<string, string> = {
        '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
        '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
      };
      return emojiDigits[digit] || digit;
    }).join('');
    text += `➕${numberToEmoji(guesses.length - 5)} de plus\n`;
  }
  text += URL;
  return text;
}
