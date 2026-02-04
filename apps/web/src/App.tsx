import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { LoginPage } from './components/LoginPage';
import { I18nProvider } from './context/I18nContext';
import { ExceptionsQueuePage } from './pages/ExceptionsQueuePage';
import { HomePage } from './pages/HomePage';
import { NotFound } from './pages/NotFound';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { TimecardPage } from './pages/TimecardPage';
import { TimeClockPage } from './pages/TimeClockPage';
import { AuthenticatedRoute } from './routes/AuthenticatedRoute';
import { initializeApiClient } from './services/api-client';
import { initializeCognitoAuth } from './services/cognito-auth';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="properties" element={<PlaceholderPage title="Properties" />} />
        <Route path="employees" element={<PlaceholderPage title="Employees" />} />
        <Route path="schedules" element={<PlaceholderPage title="Schedules" />} />
        <Route path="tasks" element={<PlaceholderPage title="Tasks" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const cognitoConfig = {
      region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
      redirectUri:
        import.meta.env['VITE_COGNITO_REDIRECT_URI'] || 'http://localhost:5173/auth/callback',
      logoutUri: import.meta.env['VITE_COGNITO_LOGOUT_URI'] || 'http://localhost:5173/login',
    };

    try {
      initializeCognitoAuth(cognitoConfig);
    } catch (error) {
      console.error('Failed to initialize Cognito:', error);
    }

    const apiBaseUrl = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:3001';
    try {
      initializeApiClient(apiBaseUrl);
    } catch (error) {
      console.error('Failed to initialize API client:', error);
    }

    setIsInitialized(true);
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
