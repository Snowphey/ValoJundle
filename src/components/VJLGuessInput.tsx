import React, { useState, useEffect } from "react";
import type { VJLPerson } from '../types/VJLPerson';
import vjl from "../data/vjl.json";
import "./VJLGuessInput.css";

interface VJLGuessInputProps {
  onGuess?: (person: VJLPerson) => void;
}

const VJLGuessInput: React.FC<VJLGuessInputProps> = ({ onGuess }) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<VJLPerson[]>([]);
  const [guessedPfps, setGuessedPfps] = useState<string[]>([]); // Ajouté

  function normalize(str: string) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  useEffect(() => {
    if (input.length > 0) {
      const normInput = normalize(input);
      // 1. Prénoms qui commencent par l'input
      const prenomStartsWith = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPfps.includes(p.pfp)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        return normPrenom.startsWith(normInput);
      });
      // 2. Alias qui commencent par l'input
      const aliasStartsWith = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPfps.includes(p.pfp)) return false;
        if (prenomStartsWith.includes(p)) return false;
        const normAliases = p.aliases ? p.aliases.map(a => normalize(a)) : [];
        return normAliases.some(a => a.startsWith(normInput));
      });
      // 3. Prénoms qui contiennent l'input ailleurs
      const prenomContains = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPfps.includes(p.pfp)) return false;
        const normPrenom = p.prenom ? normalize(p.prenom) : "";
        if (prenomStartsWith.includes(p) || aliasStartsWith.includes(p)) return false;
        return normPrenom.includes(normInput);
      });
      // 4. Alias qui contiennent l'input ailleurs
      const aliasContains = (vjl as VJLPerson[]).filter((p) => {
        if (guessedPfps.includes(p.pfp)) return false;
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
  }, [input, guessedPfps]);

  const handleSelect = (person: VJLPerson) => {
    setInput("");
    setSuggestions([]);
    setGuessedPfps(prev => [...prev, person.pfp]); // Ajouté
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
              <img src={import.meta.env.BASE_URL + 'pfps/' + person.pfp} alt={person.prenom} loading="lazy" />
              <span>{person.prenom}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

export default VJLGuessInput;
