import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

const FONT_MONO = 'var(--font-mono)';

interface NavItem {
  label: string;
  to: string;
  matches: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'DASHBOARD',
    to: '/dashboard',
    matches: (p) => p === '/dashboard' || p === '/',
  },
  {
    label: 'QI REVIEW',
    to: '/qi-review',
    matches: (p) =>
      p.startsWith('/qi-review') ||
      p.startsWith('/processing') ||
      p.startsWith('/review') ||
      p.startsWith('/finalize'),
  },
  {
    label: 'PCR',
    to: '/pcr-new',
    matches: (p) =>
      p.startsWith('/pcr-new') ||
      p.startsWith('/pcr-draft') ||
      (p.startsWith('/pcr/') && !p.startsWith('/pcr-')),
  },
  {
    label: 'ARCHIVE',
    to: '/archive',
    matches: (p) => p.startsWith('/archive'),
  },
];

export function AppNavbar({ right }: { right?: ReactNode }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const isDemo = search.get('demo') === '1';
  const withDemo = (to: string) =>
    isDemo ? `${to}${to.includes('?') ? '&' : '?'}demo=1` : to;

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm"
      style={{ fontFamily: FONT_MONO }}
    >
      <div className="px-10 py-4 flex items-center gap-8">
        <Link
          to="/"
          className="tracking-[0.2em] text-sm text-foreground hover:text-primary transition-colors"
          aria-label="Calyx home"
        >
          CALYX
        </Link>

        <span className="block h-4 w-px bg-border" aria-hidden />

        <nav
          className="flex items-center gap-7"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.matches(location.pathname);
            return (
              <Link
                key={item.to}
                to={withDemo(item.to)}
                className={`text-[11px] tracking-[0.18em] transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative inline-block">
                  {item.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-[18px] left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {isDemo && (
            <span
              className="px-2 py-0.5 border border-border text-[10px] tracking-[0.18em] text-primary bg-surface"
              aria-label="Demo mode active"
            >
              DEMO
            </span>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}
