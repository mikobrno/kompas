import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface OptionItem {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: OptionItem[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Lehký, bez závislostí: vyhledávací select (combobox) s filtrováním a klávesnicí
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<number>(-1);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Udrž vybraný label v inputu při zavření
  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? '');
    }
  }, [open, selected?.label]);

  // Klik mimo zavře dropdown
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const listboxId = useMemo(() => `ss-listbox-${Math.random().toString(36).slice(2)}`, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min((h < 0 ? -1 : h) + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        const option = filtered[highlight] ?? filtered[0];
        if (option) {
          onChange(option.value);
          setOpen(false);
          setHighlight(-1);
          inputRef.current?.blur();
        }
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
      setQuery(selected?.label ?? '');
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative">
  <input
        ref={inputRef}
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.label ?? '');
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={
          className ??
          'w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition'
        }
      />

      {open && (
        <div
          id={listboxId}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Nenalezeno</div>
          ) : (
            filtered.map((o, idx) => (
              <div
                key={o.value}
                id={`${listboxId}-${idx}`}
                className={
                  'cursor-pointer px-3 py-2 text-sm ' +
                  (idx === highlight
                    ? 'bg-[#f05a28]/10 text-slate-900 dark:text-white'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700')
                }
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  // onMouseDown kvůli tomu, aby se výběr provedl dřív než blur
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                  setHighlight(-1);
                  setQuery(o.label);
                }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
