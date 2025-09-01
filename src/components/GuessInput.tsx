import React, { useState, useEffect, useRef } from "react";
import type { VJLPerson } from '../types/VJLPerson';
import { useVJLData } from '../context/VJLDataContext';
import "./GuessInput.css";
import { loadGame } from '../api/api';

interface GuessInputProps {
  onGuess?: (person: VJLPerson) => void;
  mode: string;
  hardcore?: boolean;
  anchorId?: string;
}

const GuessInput: React.FC<GuessInputProps> = ({ onGuess, mode, hardcore, anchorId }) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<VJLPerson[]>([]);
  const [guessedPersonIds, setGuessedPersonIds] = useState<number[]>([]);
  const [loadingGuesses, setLoadingGuesses] = useState(true);
  const { vjlData } = useVJLData();
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus automatique sur l'input après chargement (corrige les soucis d'autoFocus natif)
  useEffect(() => {
    if (!loadingGuesses && inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [loadingGuesses]);

  function normalize(str: string) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  // Charger les guesses au montage
  useEffect(() => {
    if (hardcore) {
      setGuessedPersonIds([]);
      setLoadingGuesses(false);
    } else {
      loadGame(mode)
        .then((state: any) => {
          setGuessedPersonIds(state.guesses || []);
          setLoadingGuesses(false);
        })
        .catch(() => setLoadingGuesses(false));
    }
  }, [mode, hardcore]);

  useEffect(() => {
    const trimmed = input.trim();

    if (trimmed === '*') {
      // Afficher tout le monde (hors déjà devinés), trié par prénom
      const all = vjlData
        .filter(p => !guessedPersonIds.includes(p.id))
        .sort((a, b) =>
          normalize(a.prenom ?? '').localeCompare(normalize(b.prenom ?? ''))
        );
      setSuggestions(all);
      return;
    }

    if (input.length > 0) {
      const normInput = normalize(input);
      // 1. Prénoms qui commencent par l'input
      const prenomStartsWith = vjlData.filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        return normPrenom.startsWith(normInput);
      });
      // 2. Alias qui commencent par l'input
      const aliasStartsWith = vjlData.filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        if (prenomStartsWith.includes(p)) return false;
        const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
        return normAliases.some(a => a.startsWith(normInput));
      });
      // 3. Prénoms qui contiennent l'input ailleurs
      const prenomContains = vjlData.filter((p) => {
        if (guessedPersonIds.includes(p.id)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        if (prenomStartsWith.includes(p) || aliasStartsWith.includes(p)) return false;
        return normPrenom.includes(normInput);
      });
      // 4. Alias qui contiennent l'input ailleurs
      const aliasContains = vjlData.filter((p) => {
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
    const found = vjlData.find(p => {
      const normPrenom = p.prenom ? normalize(p.prenom) : "";
      const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
      return normPrenom === normInput || normAliases.includes(normInput);
    });
    if (found) {
      handleSelect(found);
    }
  };

  return (
    <form id={anchorId} className="guess-input" onSubmit={handleSubmit} autoComplete="off">
      <div className="guess-input-row">
        <input
          ref={inputRef}
          type="text"
          placeholder={'Tape un prénom ...'}
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
            <li key={person.avatarUrl || person.id} onClick={() => handleSelect(person)}>
              <img src={person.avatarUrl ? `${person.avatarUrl}?v=${new Date().toISOString().slice(0,10)}` : ''} alt={person.prenom} style={{ objectFit: 'cover', background: '#222' }} />
              <span>{person.prenom}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

export default GuessInput;
