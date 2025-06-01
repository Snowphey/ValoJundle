import answersData from '../data/answers.json';

type AnswersType = {
  [mode: string]: {
    [date: string]: number;
  };
};

let answers: AnswersType = {};
try {
  if (answersData && typeof answersData === 'object' && Object.keys(answersData).length > 0) {
    // Transform answersData to match AnswersType
    const transformed: AnswersType = {};
    Object.values(answersData).forEach((entry: any) => {
      if (entry.modes && entry.date) {
        Object.keys(entry.modes).forEach((mode: string) => {
          if (!transformed[mode]) transformed[mode] = {};
          transformed[mode][entry.date] = entry.modes[mode].answer;
        });
      }
    });
    answers = transformed;
  }
} catch {
  answers = {};
}

/**
 * Retourne l'id de la réponse pour un mode et une date donnés (format YYYY-MM-DD)
 */
export function getAnswerForDate(mode: string, date: string): number | null {
  if (!answers || !answers[mode] || !answers[mode][date]) return null;
  return answers[mode][date];
}
