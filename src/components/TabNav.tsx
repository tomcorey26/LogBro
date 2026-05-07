'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHaptics } from '@/hooks/use-haptics';

const TABS = [
  { href: '/routines', label: 'Routines' },
  { href: '/habits', label: 'Habits' },
  { href: '/history', label: 'History' },
  { href: '/rankings', label: 'Rankings' },
];

export function TabNav({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const pathname = usePathname();
  const { trigger } = useHaptics();

  if (orientation === 'vertical') {
    return (
      <nav className="flex flex-col gap-1">
        {TABS.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => trigger('selection')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              pathname.startsWith(tab.href)
                ? 'bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex mb-4 rounded-lg bg-muted p-1">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          onClick={() => trigger('selection')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-center ${
            pathname.startsWith(tab.href)
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
