import { useId } from 'react';
import { CATEGORY_COLOR_PALETTE, normalizeHexColor } from '../lib/colors';

interface CategoryColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export const CategoryColorPicker = ({ value, onChange, label }: CategoryColorPickerProps) => {
  const normalizedValue = normalizeHexColor(value);
  const radioName = `category-color-${useId()}`;

  return (
    <fieldset className="border-0 p-0 m-0">
      {label && (
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {label}
        </legend>
      )}
      <div className="grid grid-cols-5 gap-3 mb-3">
        {CATEGORY_COLOR_PALETTE.map((preset) => {
          const normalized = normalizeHexColor(preset);
          const isActive = normalizedValue === normalized;
          return (
            <label
              key={normalized}
              className={`relative flex h-10 rounded-xl border-2 transition focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#f05a28] ${
                isActive ? 'border-white shadow-lg ring-2 ring-offset-2 ring-[#f05a28]' : 'border-transparent'
              }`}
              style={{ backgroundColor: normalized }}
            >
              <span className="sr-only">Barva {normalized}</span>
              <input
                type="radio"
                name={radioName}
                value={normalized}
                checked={isActive}
                onChange={() => onChange(normalized)}
                className="sr-only"
              />
              {isActive && (
                <span className="absolute inset-1 rounded-lg border border-white/80 pointer-events-none" aria-hidden="true" />
              )}
            </label>
          );
        })}
      </div>
      <label className="flex items-center gap-3 mb-3 text-sm text-slate-600 dark:text-slate-400">
        <span>Vlastní barva</span>
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => onChange(normalizeHexColor(event.target.value))}
          className="h-9 w-16 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-1"
          aria-label="Vybrat vlastní barvu"
        />
      </label>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400 font-mono">
        {normalizedValue.toUpperCase()}
      </div>
    </fieldset>
  );
};
