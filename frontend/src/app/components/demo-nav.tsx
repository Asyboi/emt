import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';

const DEMO_ID = PRIMARY_MOCK_INCIDENT_ID;

const links: Array<{ label: string; to: string; matches: (pathname: string) => boolean }> = [
  { label: 'INTAKE', to: '/qi-review', matches: (p) => p.startsWith('/qi-review') },
  { label: 'PROCESSING', to: '/processing', matches: (p) => p.startsWith('/processing') },
  { label: 'REVIEW', to: `/review/${DEMO_ID}`, matches: (p) => p.startsWith('/review') },
  { label: 'FINALIZE', to: `/finalize/${DEMO_ID}`, matches: (p) => p.startsWith('/finalize') },
  { label: 'ARCHIVE', to: '/archive', matches: (p) => p.startsWith('/archive') },
];

export function DemoNav() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const urlActive = params.get('demo') === '1';
  const stickyActive =
    typeof window !== 'undefined' && sessionStorage.getItem('calyx-demo') === '1';
  const active = urlActive || stickyActive;

  useEffect(() => {
    if (urlActive) {
      sessionStorage.setItem('calyx-demo', '1');
    }
  }, [urlActive]);

  // If the user is in demo mode but an internal navigation dropped the
  // ?demo=1 flag, restore it on the URL so links stay consistent.
  useEffect(() => {
    if (active && !urlActive && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('demo', '1');
      window.history.replaceState({}, '', url.toString());
    }
  }, [active, urlActive, location.pathname, location.search]);

  if (!active) return null;

  // Hide the floating demo nav on PCR pages — those flows have their own
  // header chrome and the bottom bar overlaps the editor / read-only view.
  if (location.pathname.startsWith('/pcr')) return null;

  const withDemo = (to: string) => `${to}${to.includes('?') ? '&' : '?'}demo=1`;

  const exit = () => {
    sessionStorage.removeItem('calyx-demo');
    navigate('/', { replace: true });
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 border border-border bg-surface/95 px-2 py-2 shadow-lg backdrop-blur-sm"
      style={{ fontFamily: 'var(--font-mono)' }}
      role="navigation"
      aria-label="Demo navigation"
    >
      <span className="px-2 text-[10px] tracking-[0.18em] text-primary">DEMO</span>
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      {links.map((link) => {
        const isActive = link.matches(location.pathname);
        return (
          <NavLink
            key={link.to}
            to={withDemo(link.to)}
            className={`px-2 py-1 text-[10px] tracking-[0.15em] transition-colors ${
              isActive ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            {link.label}
          </NavLink>
        );
      })}
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={exit}
        className="px-2 py-1 text-[10px] tracking-[0.15em] text-foreground-secondary hover:text-destructive transition-colors"
        aria-label="Exit demo mode"
      >
        EXIT
      </button>
    </div>
  );
}
