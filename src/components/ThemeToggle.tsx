'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
