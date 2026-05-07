'use client';

import { Minus, Plus } from 'lucide-react';

export function Stepper({
  value,
  min,
  max,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  'aria-label': string;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-input h-7 bg-input-bg">
      <button
        type="button"
        onClick={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Decrease ${ariaLabel}`}
        className="flex items-center justify-center h-full w-7 bg-primary/10 text-primary hover:bg-primary/20 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none rounded-l-md border-r border-input"
      >
        <Minus className="h-3 w-3" />
      </button>
      <div className="relative flex-1 min-w-[3.5rem]">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= min && v <= max) onChange(v);
          }}
          aria-label={ariaLabel}
          className="w-full h-full bg-transparent text-center text-xs font-mono tabular-nums outline-none pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
          min
        </span>
      </div>
      <button
        type="button"
        onClick={() => value < max && onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${ariaLabel}`}
        className="flex items-center justify-center h-full w-7 bg-primary/10 text-primary hover:bg-primary/20 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none rounded-r-md border-l border-input"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
