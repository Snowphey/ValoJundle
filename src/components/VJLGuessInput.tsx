import React, { useState, useEffect } from "react";
import type { VJLPerson } from '../types/VJLPerson';
import vjl from "../data/vjl.json";
import "./VJLGuessInput.css";
import { loadGame } from '../api/api';

interface VJLGuessInputProps {
  onGuess?: (person: VJLPerson) => void;
  mode: string;
}

const VJLGuessInput: React.FC<VJLGuessInputProps> = ({ onGuess, mode }) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<VJLPerson[]>([]);
  const [guessedPersonIds, setGuessedPersonIds] = useState<number[]>([]);
  const [loadingGuesses, setLoadingGuesses] = useState(true);

  function normalize(str: string) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  // Charger les guesses via l'API au montage
  useEffect(() => {
    loadGame(mode)
      .then((state: any) => {
        setGuessedPersonIds(state.guesses || []);
        setLoadingGuesses(false);
      })
      .catch(() => setLoadingGuesses(false));
  }, [mode]);

  useEffect(() => {
    if (input.length > 0) {
      const normInput = normalize(input);
      // 1. Prénoms qui commencent par l'input
      const prenomStartsWith = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        return normPrenom.startsWith(normInput);
      });
      // 2. Alias qui commencent par l'input
      const aliasStartsWith = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        if (prenomStartsWith.includes(p)) return false;
        const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
        return normAliases.some(a => a.startsWith(normInput));
      });
      // 3. Prénoms qui contiennent l'input ailleurs
      const prenomContains = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        if (prenomStartsWith.includes(p) || aliasStartsWith.includes(p)) return false;
        return normPrenom.includes(normInput);
      });
      // 4. Alias qui contiennent l'input ailleurs
      const aliasContains = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        if (prenomStartsWith.includes(p) || aliasStartsWith.includes(p) || prenomContains.includes(p)) return false;
        const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
        return normAliases.some(a => a.includes(normInput));
      });
      setSuggestions([
        ...prenomStartsWith,
        ...aliasStartsWith,
        ...prenomContains,
        ...aliasContains
      ]);
    } else {
      setSuggestions([]);
    }
  }, [input, guessedPersonIds]);

  const handleSelect = (person: VJLPerson) => {
    setInput("");
    setSuggestions([]);
    setGuessedPersonIds(prev => {
      if (prev.includes(person.id)) return prev;
      return [...prev, person.id];
    });
    if (onGuess) onGuess(person);
  };

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
      return;
    }
    const normInput = normalize(input.trim());
    const found = (vjl as VJLPerson[]).find(p => {
      const normPrenom = p.prenom ? normalize(p.prenom) : "";
      const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
      return normPrenom === normInput || normAliases.includes(normInput);
    });
    if (found) {
      handleSelect(found);
    }
  };

  return (
    <form className="vjl-guess-input" onSubmit={handleSubmit} autoComplete="off">
      <div className="vjl-guess-input-row">
        <input
          type="text"
          placeholder="Tape un prénom ..."
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ flex: 1 }}
          disabled={loadingGuesses}
        />
        <button
          type="submit"
          tabIndex={-1}
          aria-label="Valider"
        >
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((person) => (
            <li key={person.pfp} onClick={() => handleSelect(person)}>
              <img src={'pfps/' + person.pfp} alt={person.prenom} loading="lazy" />
              <span>{person.prenom}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

export default VJLGuessInput;
