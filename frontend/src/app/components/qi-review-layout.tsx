import { Outlet } from 'react-router';
import { DemoNav } from './demo-nav';

export function QIReviewLayout() {
  return (
    <>
      <Outlet />
      <DemoNav />
    </>
  );
}
