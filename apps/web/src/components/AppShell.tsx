import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { SelectionProvider, useSelection } from '../context/SelectionContext';
import { getCurrentUser, getProperty } from '../services/api-client';
import { getAuthService } from '../services/cognito-auth';
import { geocodeAddress, getTimezoneFromLocation } from '../services/geocoding-service';
import { queryKeys } from '../services/query-keys';
import { getWeatherForLocation } from '../services/weather-service';

import { LoadingSkeleton } from './LoadingSkeleton';
import { PropertySelector } from './PropertySelector';
import { UserProfileModal } from './UserProfileModal';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  icon: string; // Now required
  fullLabel: string;
}

interface Tab {
  id: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', icon: 'home', fullLabel: 'Home' },
  {
    label: 'Schedule Management',
    path: '/schedule-management',
    roles: [
      'Platform Administrator',
      'Property Administrator',
      'HR Manager',
      'Department Manager',
      'Admin',
      'Manager',
    ],
    icon: 'calendar',
    fullLabel: 'Schedule Management',
  },
  {
    label: 'Time Management',
    path: '/timecard',
    roles: ['Admin', 'Manager', 'Employee'],
    icon: 'clock',
    fullLabel: 'Time Management',
  },
  {
    label: 'Employee Management',
    path: '/employees',
    roles: ['Admin', 'Manager'],
    icon: 'users',
    fullLabel: 'Employee Management',
  },
  {
    label: 'HR Management',
    path: '/hr-management',
    roles: ['Platform Administrator', 'Property Administrator', 'HR Manager', 'Admin', 'Manager'],
    icon: 'id-badge',
    fullLabel: 'HR Management',
  },
  {
    label: 'Housekeeping',
    path: '/tasks',
    roles: ['Admin', 'Manager', 'Employee'],
    icon: 'broom',
    fullLabel: 'Housekeeping',
  },
  {
    label: 'Org Structure',
    path: '/org-structure',
    icon: 'sitemap',
    fullLabel: 'Organization Structure',
  },
  {
    label: 'Maintenance Operations',
    path: '/properties',
    roles: ['Admin', 'Manager'],
    icon: 'wrench',
    fullLabel: 'Maintenance',
  },
  {
    label: 'User Administration',
    path: '/profile',
    icon: 'user',
    fullLabel: 'User Administration',
  },
  {
    label: 'Settings',
    path: '/settings',
    roles: ['Platform Administrator', 'Property Administrator'],
    icon: 'cog',
    fullLabel: 'Settings',
  },
];

function hasAnyRole(userRoles: string[] = [], requiredRoles: string[] = []) {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((role) => userRoles.includes(role));
}

function AppShellContent(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPropertyId, setSelectedPropertyId } = useSelection();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ id: 'home', label: 'Home', path: '/' }]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [weather, setWeather] = useState<{
    temperature: number;
    condition: string;
    icon: string;
  } | null>(null);
  const [formattedDate, setFormattedDate] = useState('');
  const [formattedTime, setFormattedTime] = useState('');
  const [propertyTimezone, setPropertyTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  });

  const hasAuthToken = (() => {
    try {
      return Boolean(getAuthService().getAccessToken());
    } catch {
      return false;
    }
  })();

  // Fetch user preferences including avatar
  const userPreferencesQuery = useQuery({
    queryKey: ['userPreferences', 'me'] as const,
    queryFn: async () => {
      const { getApiClient } = await import('../services/api-client');
      const apiClient = getApiClient();
      return apiClient.get<{ avatarUrl: string | null; defaultPropertyId: string | null }>(
        '/api/users/me/preferences'
      );
    },
    enabled: !!currentUserQuery.data && hasAuthToken,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Set default property from user preferences on initial load
  useEffect(() => {
    if (userPreferencesQuery.data?.defaultPropertyId && !selectedPropertyId) {
      setSelectedPropertyId(userPreferencesQuery.data.defaultPropertyId);
    }
  }, [userPreferencesQuery.data, selectedPropertyId]);

  const selectedProperty = useQuery({
    queryKey: ['property', selectedPropertyId],
    queryFn: () => (selectedPropertyId ? getProperty(selectedPropertyId) : Promise.resolve(null)),
    enabled: Boolean(selectedPropertyId),
  });

  const currentUser = currentUserQuery.data;

  // Fetch weather and timezone when property changes
  useEffect(() => {
    if (selectedProperty.data?.address && selectedProperty.data?.city) {
      const fullAddress = `${selectedProperty.data.address}, ${selectedProperty.data.city}${selectedProperty.data.state ? ', ' + selectedProperty.data.state : ''}${selectedProperty.data.zipCode ? ' ' + selectedProperty.data.zipCode : ''}`;

      geocodeAddress(fullAddress).then((location) => {
        if (location) {
          getWeatherForLocation(location.latitude, location.longitude).then(setWeather);
          getTimezoneFromLocation(location.latitude, location.longitude).then((timezone) => {
            setPropertyTimezone(timezone);
          });
        }
      });
    } else {
      // Reset to browser timezone when no property selected
      setPropertyTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [selectedProperty.data]);

  // Update date/time every minute using property's timezone
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: propertyTimezone,
      }).format(now);
      const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: propertyTimezone,
      }).format(now);
      setFormattedDate(formatted);
      setFormattedTime(time);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, [propertyTimezone]);

  // Handle new tab opening when clicking nav items
  useEffect(() => {
    const navItem = NAV_ITEMS.find((item) => item.path === location.pathname);
    if (navItem && navItem.path !== '/') {
      const tabId = navItem.path;

      setOpenTabs((prevTabs) => {
        const existingTab = prevTabs.find((t) => t.id === tabId);
        if (!existingTab) {
          return [...prevTabs, { id: tabId, label: navItem.label, path: navItem.path }];
        }
        return prevTabs;
      });

      setActiveTabId(tabId);
    } else if (navItem?.path === '/') {
      setActiveTabId('home');
    }
  }, [location.pathname]);

  const handleLogout = () => {
    try {
      getAuthService().logout();
    } catch {
      localStorage.removeItem('auth_tokens');
    }
    navigate('/login');
  };

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setOpenTabs((currentTabs) => {
        const remaining = currentTabs.filter((t) => t.id !== tabId);

        // If we're closing the active tab, determine next tab and navigate
        if (activeTabId === tabId) {
          if (remaining.length > 0) {
            // Find the index of the closed tab to determine next tab
            const closedIndex = currentTabs.findIndex((t) => t.id === tabId);
            // Prefer left neighbor, else take the first remaining tab
            const nextTab = remaining[Math.max(0, closedIndex - 1)] || remaining[0];
            // Use setTimeout to defer navigation until after state update completes
            setTimeout(() => {
              setActiveTabId(nextTab.id);
              navigate(nextTab.path);
            }, 0);
          } else {
            // No more tabs, go home
            setTimeout(() => {
              setActiveTabId('home');
              navigate('/');
            }, 0);
          }
        }

        return remaining;
      });
    },
    [navigate, activeTabId]
  );

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTabId(tab.id);
      navigate(tab.path);
    },
    [navigate]
  );

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

  const rawDisplayName = currentUser?.name?.trim() || currentUser?.email?.split('@')[0] || 'User';
  const displayName = (() => {
    const parts = rawDisplayName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return rawDisplayName;
    }

    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');
    const maxLength = 25;
    let formatted = `${lastName}, ${firstName}`;

    if (formatted.length > maxLength) {
      const available = maxLength - (lastName.length + 2);
      if (available <= 0) {
        return lastName;
      }
      const truncatedFirst = firstName.slice(0, available).trimEnd();
      formatted = `${lastName}, ${truncatedFirst}`;
    }

    return formatted;
  })();
  const avatarInitials = (() => {
    const parts = rawDisplayName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    const firstInitial = parts[0][0] ?? '';
    const lastInitial = parts[parts.length - 1][0] ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  })();

  return (
    <>
      {/* User Profile Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
        />
      )}

      <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
        <aside className="sidebar">
          <nav className="nav">
            {NAV_ITEMS.filter((item) => hasAnyRole(currentUser?.roles ?? [], item.roles ?? [])).map(
              (item) => (
                <NavLink key={item.path} to={item.path} className="nav-link" title={item.fullLabel}>
                  {renderNavIcon(item.icon)}
                  {!isSidebarCollapsed && <span className="nav-label">{item.label}</span>}
                </NavLink>
              )
            )}
          </nav>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {isSidebarCollapsed ? '▶' : '◀'}
          </button>
        </aside>
        <section className="main">
          <header className="topbar">
            <div className="app-header">
              <div className="header-left">
                <PropertySelector
                  userId={currentUser?.userId}
                  onPropertySelect={setSelectedPropertyId}
                />
              </div>
              <div className="header-center">
                <strong className="topbar-value">
                  {formattedDate} · {formattedTime}
                </strong>
                <strong className="topbar-value weather-display">
                  {weather
                    ? `${weather.icon} ${weather.temperature}°F · ${weather.condition}`
                    : '☀️ 72°F · Loading...'}
                </strong>
              </div>
              <div className="header-right">
                <div
                  className="user-chip"
                  onClick={() => setIsProfileModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="avatar">
                    {userPreferencesQuery.data?.avatarUrl ? (
                      <img src={userPreferencesQuery.data.avatarUrl} alt="User avatar" />
                    ) : (
                      avatarInitials
                    )}
                  </div>
                  <div className="user-info">
                    <p>{displayName}</p>
                    <span>{(currentUser?.roles ?? ['Manager'])[0]}</span>
                  </div>
                </div>
                <button className="secondary logout-button" onClick={handleLogout} type="button">
                  Log out
                  <span className="logout-icon" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </header>
          <div className="tabs-bar">
            <div className="tabs">
              {openTabs.map((tab) => (
                <div key={tab.id} className="tab-wrapper">
                  <button
                    type="button"
                    className={`tab ${activeTabId === tab.id ? 'tab--active' : ''}`}
                    onClick={() => handleTabClick(tab)}
                  >
                    {tab.label}
                  </button>
                  {tab.path !== '/' && (
                    <button
                      type="button"
                      className="tab-close"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCloseTab(tab.id);
                      }}
                      aria-label={`Close ${tab.label} tab`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <main className="content">
            <Outlet />
          </main>
        </section>
      </div>
    </>
  );
}

function renderNavIcon(iconName: string): React.ReactElement {
  const iconClass = `nav-icon nav-icon--${iconName}`;
  const iconSvg = getIconSVG(iconName);

  return (
    <span className={iconClass} aria-hidden>
      {iconSvg}
    </span>
  );
}

function getIconSVG(name: string): React.ReactElement {
  const svgs: Record<string, string> = {
    home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V8h14v13z"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2.4" stroke="white" fill="none" stroke-width="2"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    'id-badge':
      '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><path d="M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm-2.5 7c.6-2.2 3.1-3.5 5.5-3.5s4.9 1.3 5.5 3.5" fill="none" stroke="white" stroke-width="2"/></svg>',
    broom:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3l1.2 3L10 7.2 7.2 8.4 6 11 4.8 8.4 2 7.2 4.8 6z"/><path d="M15 2l1.4 3.6L20 7l-3.6 1.4L15 12l-1.4-3.6L10 7l3.6-1.4z"/><path d="M13 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>',
    sitemap:
      '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="9.5" y="2" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="17" y="2" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><line x1="4.5" y1="5" x2="4.5" y2="8" stroke="currentColor" stroke-width="0.5"/><line x1="12" y1="5" x2="12" y2="8" stroke="currentColor" stroke-width="0.5"/><line x1="19.5" y1="5" x2="19.5" y2="8" stroke="currentColor" stroke-width="0.5"/><rect x="2" y="9" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="9.5" y="9" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="17" y="9" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><line x1="4.5" y1="12" x2="4.5" y2="15" stroke="currentColor" stroke-width="0.5"/><line x1="12" y1="12" x2="12" y2="15" stroke="currentColor" stroke-width="0.5"/><line x1="19.5" y1="12" x2="19.5" y2="15" stroke="currentColor" stroke-width="0.5"/><rect x="2" y="16" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="9.5" y="16" width="5" height="3" stroke="currentColor" stroke-width="0.5"/><rect x="17" y="16" width="5" height="3" stroke="currentColor" stroke-width="0.5"/></svg>',
    wrench:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.6C.4 7 .9 10 2.9 12c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.12.62l2.03 1.58c-.05.3-.07.62-.07.94 0 .33.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.12-.62l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
  };

  const svgStr = svgs[name] ?? svgs['home'];
  return <span dangerouslySetInnerHTML={{ __html: svgStr ?? '' }} />;
}

export function AppShell(): React.ReactElement {
  return (
    <SelectionProvider>
      <AppShellContent />
    </SelectionProvider>
  );
}
