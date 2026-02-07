import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function NewLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    // Validation
    if (!email) {
      setEmailError('The field is required.');
      return;
    }

    if (!password) {
      setPasswordError('The field is required.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }

      const data = await response.json();

      // Store token in localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to app
      navigate('/');
      window.location.reload(); // Reload to update auth state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--uf-teal-50)',
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
            <path d="M24 4L4 14L24 24L44 14L24 4Z" fill="var(--uf-teal-50)" />
            <path d="M4 24L24 34L44 24" stroke="var(--uf-teal-50)" strokeWidth="2" fill="none" />
            <path d="M4 34L24 44L44 34" stroke="var(--uf-teal-50)" strokeWidth="2" fill="none" />
          </svg>
          <h1
            style={{
              fontSize: '28px',
              marginTop: '8px',
              color: 'var(--uf-teal-40)',
              fontWeight: '600',
              letterSpacing: '1px',
            }}
          >
            UNIFOCUS
          </h1>
        </div>

        <p
          style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
            color: 'var(--uf-text-color)',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Workforce Management Platform
        </p>

        <h2 style={{ fontSize: '20px', marginBottom: '1.5rem', color: 'var(--uf-text-color)' }}>
          Sign In
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Username/Email Field */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '14px',
                color: 'var(--uf-text-color)',
              }}
            >
              Username
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="Username"
              style={{
                width: '100%',
                padding: '12px',
                border: emailError
                  ? '1px solid var(--uf-error-50)'
                  : '1px solid var(--uf-border-color)',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            {emailError && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                }}
              >
                <small style={{ color: 'var(--uf-error-50)', fontSize: '12px' }}>
                  {emailError}
                </small>
                <a
                  href="#"
                  style={{ color: 'var(--uf-teal-50)', fontSize: '12px', textDecoration: 'none' }}
                >
                  Forgot your username?
                </a>
              </div>
            )}
            {!emailError && (
              <div style={{ textAlign: 'right', marginTop: '4px' }}>
                <a
                  href="#"
                  style={{ color: 'var(--uf-teal-50)', fontSize: '12px', textDecoration: 'none' }}
                >
                  Forgot your username?
                </a>
              </div>
            )}
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '14px',
                color: 'var(--uf-text-color)',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                placeholder="Password"
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '40px',
                  border: passwordError
                    ? '1px solid var(--uf-error-50)'
                    : '1px solid var(--uf-border-color)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--uf-text-color-secondary)',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {passwordError && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                }}
              >
                <small style={{ color: 'var(--uf-error-50)', fontSize: '12px' }}>
                  {passwordError}
                </small>
                <a
                  href="/forgot-password"
                  style={{ color: 'var(--uf-teal-50)', fontSize: '12px', textDecoration: 'none' }}
                >
                  Forgot Password?
                </a>
              </div>
            )}
            {!passwordError && (
              <div style={{ textAlign: 'right', marginTop: '4px' }}>
                <a
                  href="/forgot-password"
                  style={{ color: 'var(--uf-teal-50)', fontSize: '12px', textDecoration: 'none' }}
                >
                  Forgot Password?
                </a>
              </div>
            )}
          </div>

          {/* Remember Me Toggle */}
          <div
            style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '14px', color: 'var(--uf-text-color)' }}>
              Keep me signed in:
            </span>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: rememberMe ? 'var(--uf-teal-50)' : 'var(--uf-mono-85)',
                  borderRadius: '24px',
                  transition: '0.3s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: rememberMe ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                backgroundColor: 'var(--uf-error-95)',
                color: 'var(--uf-error-20)',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isLoading ? 'var(--uf-mono-85)' : 'var(--uf-teal-50)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              marginTop: '0.5rem',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
