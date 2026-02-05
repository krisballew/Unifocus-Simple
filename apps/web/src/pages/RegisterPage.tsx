import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [userData, setUserData] = useState<{ email: string; name: string } | null>(null);

  const inviteToken = searchParams.get('token');

  useEffect(() => {
    if (!inviteToken) {
      setError('No invite token provided');
      setIsVerifying(false);
      return;
    }

    // Verify invite token
    fetch(
      `/api/auth/verify-invite/${inviteToken}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setUserData({ email: data.email, name: data.name });
        } else {
          setError('Invalid or expired invite link');
        }
      })
      .catch(() => {
        setError('Failed to verify invite token');
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        '/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inviteToken,
            password,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Registration failed');
      }

      const data = await response.json();

      // Store token in localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to app
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#2e8a99',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <p>Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#2e8a99',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            maxWidth: '450px',
            width: '100%',
          }}
        >
          <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: '#c00' }}>
            Invalid Invitation
          </h2>
          <p style={{ textAlign: 'center', marginBottom: '2rem' }}>{error}</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#2e8a99',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#2e8a99',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '450px',
          width: '100%',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            style={{ display: 'inline-block' }}
          >
            <path d="M24 4L4 14L24 24L44 14L24 4Z" fill="#2e8a99" />
            <path d="M4 24L24 34L44 24" stroke="#2e8a99" strokeWidth="2" fill="none" />
            <path d="M4 34L24 44L44 34" stroke="#2e8a99" strokeWidth="2" fill="none" />
          </svg>
          <h1 style={{ fontSize: '28px', marginTop: '8px', color: '#1e5a66', fontWeight: '600' }}>
            UNIFOCUS
          </h1>
        </div>

        <p style={{ textAlign: 'center', marginBottom: '0.5rem', color: '#333', fontSize: '14px' }}>
          Workforce Management Platform
        </p>

        <h2 style={{ fontSize: '20px', marginBottom: '1.5rem', color: '#333' }}>
          Complete Your Registration
        </h2>

        {userData && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '12px',
              backgroundColor: '#f0f8ff',
              borderRadius: '4px',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
              <strong>{userData.name}</strong>
              <br />
              {userData.email}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', color: '#333' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              required
              minLength={8}
            />
            <small style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#666' }}>
              Minimum 8 characters
            </small>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="confirmPassword"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', color: '#333' }}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#fee',
                color: '#c00',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isLoading ? '#ccc' : '#2e8a99',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '500',
            }}
          >
            {isLoading ? 'Setting up your account...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
