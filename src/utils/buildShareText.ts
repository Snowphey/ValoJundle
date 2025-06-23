import type { VJLPerson } from '../types/VJLPerson';
import type { CardStatus } from '../components/CardColumn';
import modes from '../data/modes.json';

export interface Attribute {
  key: keyof VJLPerson;
  label: string;
}

const URL = import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5173';

export function buildShareText(
  guesses: VJLPerson[],
  answer: VJLPerson,
  attributes: Attribute[],
  mode: string,
  gameNumber: string = '?'
): string {
  if (!guesses.length) return '';
  const tries = guesses.length;

  // Définition des seuils "facile" par mode
  const easyThresholds: Record<string, number> = {
    classic: 3,
    citation: 5,
    image: 5,
  };
  const easyLimit = easyThresholds[mode] || 0;
  const isOneShot = tries === 1;
  const isEasy = !isOneShot && tries > 0 && tries <= easyLimit;
  const oneShotEmoji = '🤯';

  if (mode === 'citation') {
    return `J'ai trouvé le membre #ValoJundle #${gameNumber} avec une citation en ${tries} coup${tries > 1 ? 's' : ''}${isOneShot ? ` ${oneShotEmoji}` : isEasy ? ' (facile)' : ''}  ⚔️\n\n${URL}`;
  }

  if (mode === 'image') {
    return `J'ai trouvé le membre #ValoJundle #${gameNumber} avec une image en ${tries} coup${tries > 1 ? 's' : ''}${isOneShot ? ` ${oneShotEmoji}` : isEasy ? ' (facile)' : ''}  ⚔️\n\n${URL}`;
  }

  if (mode === 'emoji') {
    return `J'ai trouvé le membre #ValoJundle #${gameNumber} avec des emojis en ${tries} coup${tries > 1 ? 's' : ''}${isOneShot ? ` ${oneShotEmoji}` : isEasy ? ' (facile)' : ''}  ⚔️\n\n${URL}`;
  }

  // Récupère le label du mode depuis modes.json
  const modeLabel = (modes.find(m => m.key === mode)?.label || mode);
  let text = `J'ai trouvé le membre #ValoJundle #${gameNumber} en mode ${modeLabel} en ${tries} coup${tries > 1 ? "s" : ""}${isOneShot ? ` ${oneShotEmoji}` : isEasy ? ' (facile)' : ''}  ⚔️\n`;
  const colorMap: Record<string, string> = {
    correct: '🟩',  
    partial: '🟧',
    incorrect: '🟥',
    higher: '⬆️',
    lower: '⬇️',
  };
  const getStatusEmoji = (status: CardStatus) => colorMap[status] || '⬛';
  const shareAttributes = attributes;
  // getStatus logic must be provided by the caller or re-implemented here
  const getStatus = (guess: VJLPerson, answer: VJLPerson, key: keyof VJLPerson): CardStatus => {
    if (key === 'height') {
      if (guess.height === answer.height) return 'correct';
      if (guess.height < answer.height) return 'higher';
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