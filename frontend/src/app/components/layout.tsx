import { Outlet } from 'react-router';
import { AppNavbar } from './app-navbar';

export function Layout() {
  return (
    <div className="h-screen flex flex-col">
      <AppNavbar />
      <main className="flex-1 min-h-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
