"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type OptionItem = { value: string; label: React.ReactNode; text: string; disabled: boolean };

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function readOptions(children: React.ReactNode): OptionItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== "option") return [];
    const { value, children: label, disabled } = child.props;
    const text = textOf(label);
    return [{ value: value === undefined ? text : String(value), label, text, disabled: Boolean(disabled) }];
  });
}

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * Lista suspensa com o mesmo contrato de um <select> controlado (`value`, `onChange(e)` com
 * `e.target.value`, `<option>` como filhos, `disabled`), mas desenhada no padrão da marca —
 * a lista nativa do navegador não aceita estilo. Teclado: setas, Home/End, Enter/Espaço,
 * Esc, letras para pular. Padrão "select-only combobox" do WAI-ARIA APG.
 */
export function SelectMenu({
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
  children,
  name,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-label": ariaLabel,
}: SelectProps) {
  const options = useMemo(() => readOptions(children), [children]);
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === current),
  );
  const selected = options[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-lista`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (value === undefined) setInner(option.value);
      if (option.value !== current) {
        // Mesmo formato que os containers já consomem: e.target.value.
        onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }
      close();
    },
    [options, value, current, onChange, name, close],
  );

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function step(from: number, delta: 1 | -1) {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + delta + options.length) % options.length;
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function typeahead(key: string) {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 600 ? typed.current.text + key : key, at: now };
    const query = typed.current.text.toLocaleLowerCase("pt-BR");
    const start = open ? active : selectedIndex;
    const order = [...options.keys()].map((k) => (start + 1 + k) % options.length);
    const hit = order.find((i) => !options[i]!.disabled && options[i]!.text.toLocaleLowerCase("pt-BR").startsWith(query));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else commit(hit);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          setActive(selectedIndex);
          setOpen(true);
          return;
        }
        setActive((a) => step(a, e.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? step(options.length - 1, 1) : step(0, -1));
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) commit(active);
        else {
          setActive(selectedIndex);
          setOpen(true);
        }
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        return;
      case "Tab":
        if (open) setOpen(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          setActive(selectedIndex);
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-field border bg-surface pl-3 pr-2.5 text-left text-body text-fg transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          open ? "border-action ring-2 ring-action/20" : "border-fg-subtle/40 hover:border-fg-subtle",
          "disabled:cursor-not-allowed disabled:bg-page disabled:text-fg-muted disabled:opacity-70",
          invalid && "border-danger",
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ""}</span>
        <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 text-fg-muted transition-transform duration-200", open && "rotate-180 text-link")} />
      </button>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={buttonId}
        tabIndex={-1}
        hidden={!open}
        className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-64 origin-top animate-[cl-pop_140ms_ease-out] overflow-auto rounded-field border border-line bg-raised p-1 shadow-popover motion-reduce:animate-none"
      >
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isActive = index === active;
          return (
            <li
              key={`${option.value}-${index}`}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => !option.disabled && setActive(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(index)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-body",
                isActive && !option.disabled && "bg-action-soft text-link",
                !isActive && "text-fg",
                isSelected && "font-semibold",
                option.disabled && "cursor-not-allowed text-fg-subtle",
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {isSelected && (
                <Icon name="check" className="text-link" />
              )}
            </li>
          );
        })}
      </ul>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
