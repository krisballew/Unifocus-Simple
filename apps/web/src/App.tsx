import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { LoginPage } from './components/LoginPage';
import { I18nProvider } from './context/I18nContext';
import { AvailabilityPage } from './features/scheduleManagement/pages/AvailabilityPage';
import { RequestsPage } from './features/scheduleManagement/pages/RequestsPage';
import { ScheduleEditorPage } from './features/scheduleManagement/pages/ScheduleEditorPage';
import { SchedulePeriodsPage } from './features/scheduleManagement/pages/SchedulePeriodsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ExceptionsQueuePage } from './pages/ExceptionsQueuePage';
import { HomePage } from './pages/HomePage';
import { HrManagementPage } from './pages/HrManagementPage';
import { NewLoginPage } from './pages/NewLoginPage';
import { NotFound } from './pages/NotFound';
import { OrgStructurePage } from './pages/OrgStructurePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { RegisterPage } from './pages/RegisterPage';
import { ScheduleManagementHub } from './pages/ScheduleManagementHub';
import { SettingsPage } from './pages/SettingsPage';
import { TimecardPage } from './pages/TimecardPage';
import { TimeClockPage } from './pages/TimeClockPage';
import { UserAdministrationPage } from './pages/UserAdministrationPage';
import { AuthenticatedRoute } from './routes/AuthenticatedRoute';
import { initializeApiClient } from './services/api-client';
import { initializeCognitoAuth } from './services/cognito-auth';

// Feature flags
const FEATURE_SCHEDULING_V2 = import.meta.env.VITE_FEATURE_SCHEDULING_V2 === 'true';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<NewLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<LoginPage />} />
      <Route
        element={
          <AuthenticatedRoute>
            <AppShell />
          </AuthenticatedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="time-clock" element={<TimeClockPage />} />
        <Route path="timecard" element={<TimecardPage />} />
        <Route path="exceptions" element={<ExceptionsQueuePage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="hr-management" element={<HrManagementPage />} />
        <Route path="org-structure" element={<OrgStructurePage />} />
        {/* Schedule Management - Canonical Routes */}
        <Route
          path="schedule-management"
          element={
            FEATURE_SCHEDULING_V2 ? (
              <ScheduleManagementHub />
            ) : (
              <PlaceholderPage title="Schedule Management" />
            )
          }
        />
        <Route
          path="schedule-management/periods"
          element={
            FEATURE_SCHEDULING_V2 ? (
              <SchedulePeriodsPage />
            ) : (
              <PlaceholderPage title="Schedule Periods" />
            )
          }
        />
        <Route
          path="schedule-management/editor"
          element={
            FEATURE_SCHEDULING_V2 ? (
              <ScheduleEditorPage />
            ) : (
              <PlaceholderPage title="Schedule Editor" />
            )
          }
        />
        <Route
          path="schedule-management/requests"
          element={
            FEATURE_SCHEDULING_V2 ? <RequestsPage /> : <PlaceholderPage title="Schedule Requests" />
          }
        />
        <Route
          path="schedule-management/availability"
          element={
            FEATURE_SCHEDULING_V2 ? (
              <AvailabilityPage />
            ) : (
              <PlaceholderPage title="Availability Management" />
            )
          }
        />
        {/* Legacy route - redirect to canonical path */}
        <Route path="schedules" element={<Navigate to="/schedule-management" replace />} />
        <Route path="tasks" element={<PlaceholderPage title="Tasks" />} />
        <Route path="profile" element={<UserAdministrationPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      const cognitoConfig = {
        region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
        clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
        domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
        redirectUri:
          import.meta.env['VITE_COGNITO_REDIRECT_URI'] || 'http://localhost:3000/auth/callback',
        logoutUri: import.meta.env['VITE_COGNITO_LOGOUT_URI'] || 'http://localhost:3000/login',
      };

      try {
        initializeCognitoAuth(cognitoConfig);
      } catch (error) {
        console.error('Failed to initialize Cognito:', error);
      }

      // Determine API base URL with smart detection
      let apiBaseUrl = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:3001';

      if (import.meta.env.DEV) {
        // In development, use the configured API URL or fall back to /api proxy
        // The /api proxy works with Vite's development server and Codespaces

        // Skip direct health checks in Codespace environments (detected by domain pattern)
        const isCodespace =
          typeof window !== 'undefined' && window.location.hostname.includes('.github.dev');

        if (isCodespace) {
          console.log('Detected Codespace environment, using /api proxy');
          apiBaseUrl = '/api';
        } else {
          // Local development: try direct connection first, then fall back to proxy
          const apiUrls = [apiBaseUrl];

          let finalUrl: string | null = null;

          for (const url of apiUrls) {
            try {
              const controller = new AbortController();
              const timeoutId = window.setTimeout(() => controller.abort(), 2000);

              const response = await fetch(`${url}/health`, {
                method: 'HEAD',
                signal: controller.signal,
              }).catch(() => null);

              window.clearTimeout(timeoutId);

              if (response && response.ok) {
                finalUrl = url;
                console.log(`✓ API verified at ${url}`);
                break;
              }
            } catch (error) {
              // Continue to next URL
            }
          }

          // If direct URL didn't work, use /api proxy
          if (!finalUrl) {
            console.log('Using /api proxy for API requests');
            apiBaseUrl = '/api';
          } else {
            apiBaseUrl = finalUrl;
          }
        }
      }

      try {
        initializeApiClient(apiBaseUrl);
        console.log(`API client initialized with ${apiBaseUrl}`);
      } catch (error) {
        console.error('Failed to initialize API client:', error);
      }

      setIsInitialized(true);
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <LoadingSkeleton lines={5} card />;
  }

  return (
    <I18nProvider>
      <AppRoutes />
    </I18nProvider>
  );
}
