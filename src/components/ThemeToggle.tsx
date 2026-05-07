'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';

const NEXT: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABEL = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={LABEL[theme]}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
