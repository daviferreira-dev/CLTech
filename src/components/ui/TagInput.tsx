"use client";

import { useState } from "react";
import { Chip } from "./Chip";
import { Input } from "./Field";

/**
 * Lista de tags editável: Enter ou vírgula adiciona, × remove. Sem duplicatas
 * (comparação sem caixa). `id` vai para o input, para o `Field` ligar o rótulo.
 */
export function TagInput({
  id,
  values,
  onChange,
  placeholder,
  maxItems,
  maxLength,
  "aria-describedby": describedBy,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  maxLength?: number;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    const next = [...values];
    for (const item of items) {
      if (maxItems && next.length >= maxItems) break;
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <Chip onRemove={() => onChange(values.filter((v) => v !== value))} removeLabel={`Remover ${value}`}>
                {value}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(e) => {
          const value = e.target.value;
          if (value.includes(",")) commit(value);
          else setDraft(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
