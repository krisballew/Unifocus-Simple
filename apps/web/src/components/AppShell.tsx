import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { SelectionProvider } from '../context/SelectionContext';
import { getCurrentUser } from '../services/api-client';
import { getAuthService } from '../services/cognito-auth';
import { queryKeys } from '../services/query-keys';

import { LoadingSkeleton } from './LoadingSkeleton';
import { PropertySelector } from './PropertySelector';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Properties', path: '/properties', roles: ['Admin', 'Manager'] },
  { label: 'Employees', path: '/employees', roles: ['Admin', 'Manager'] },
  { label: 'Schedules', path: '/schedules', roles: ['Admin', 'Manager'] },
  { label: 'Tasks', path: '/tasks', roles: ['Admin', 'Manager', 'Employee'] },
];

function hasAnyRole(userRoles: string[] = [], requiredRoles: string[] = []) {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((role) => userRoles.includes(role));
}

export function AppShell(): React.ReactElement {
  const navigate = useNavigate();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  });

  const currentUser = currentUserQuery.data;

  const handleLogout = () => {
    try {
      getAuthService().logout();
    } catch {
      localStorage.removeItem('auth_tokens');
      navigate('/login');
    }
  };

  if (currentUserQuery.isLoading) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <LoadingSkeleton lines={6} />
        </aside>
        <main className="content">
          <LoadingSkeleton lines={8} card />
        </main>
      </div>
    );
  }

  return (
    <SelectionProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">Unifocus</div>
          <nav className="nav">
            {NAV_ITEMS.filter((item) => hasAnyRole(currentUser?.roles ?? [], item.roles ?? [])).map(
              (item) => (
                <NavLink key={item.path} to={item.path} className="nav-link">
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        </aside>
        <section className="main">
          <header className="header">
            <div className="header-left">
              <h1>Workspace</h1>
              <p>{currentUser?.email ?? 'Signed in'}</p>
            </div>
            <div className="header-right">
              <PropertySelector userId={currentUser?.userId} />
              <button className="secondary" onClick={handleLogout} type="button">
                Log out
              </button>
            </div>
          </header>
          <main className="content">
            <Outlet />
          </main>
        </section>
      </div>
    </SelectionProvider>
  );
}
