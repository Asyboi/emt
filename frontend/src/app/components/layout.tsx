import { Outlet } from 'react-router';
import { AppNavbar } from './app-navbar';

export function Layout() {
  return (
    <>
      <AppNavbar />
      <Outlet />
    </>
  );
}
