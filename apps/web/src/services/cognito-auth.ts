import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
}

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

interface AuthUser {
  username: string;
  email?: string;
  userId?: string;
  tenantId?: string;
}

class CognitoAuthService {
  private config: CognitoConfig;
  private userPool: CognitoUserPool;
  private currentUser: CognitoUser | null = null;

  constructor(config: CognitoConfig) {
    this.config = config;
    this.userPool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }

  /**
   * Redirect to Cognito Hosted UI for login
   */
  redirectToLogin(): void {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: 'email openid profile',
      redirect_uri: this.config.redirectUri,
    });

    const loginUrl = `https://${this.config.domain}/oauth2/authorize?${params.toString()}`;
    window.location.href = loginUrl;
  }

  /**
   * Handle Cognito callback after login
   */
  async handleCallback(code: string): Promise<AuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(`https://${this.config.domain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const data = await response.json();
    this.storeTokens(data);

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Direct login (username/password)
   */
  async login(username: string, password: string): Promise<AuthTokens> {
    const user = new CognitoUser({
      Username: username,
      Pool: this.userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      user.authenticateUser(authDetails, {
        onSuccess: (result) => {
          const tokens: AuthTokens = {
            accessToken: result.getAccessToken().getJwtToken(),
            idToken: result.getIdToken().getJwtToken(),
            refreshToken: result.getRefreshToken()?.getToken(),
          };
          this.storeTokens(tokens);
          this.currentUser = user;
          resolve(tokens);
        },
        onFailure: (error) => {
          reject(new Error(`Authentication failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    const user = this.userPool.getCurrentUser();
    if (!user) {
      return null;
    }

    this.currentUser = user;
    return {
      username: user.getUsername(),
    };
  }

  /**
   * Get user attributes
   */
  async getUserAttributes(): Promise<Record<string, string>> {
    const user = this.userPool.getCurrentUser();
    if (!user) {
      throw new Error('No user session');
    }

    return new Promise((resolve, reject) => {
      user.getUserAttributes((error, attributes) => {
        if (error) {
          reject(error);
        } else {
          const attrs: Record<string, string> = {};
          attributes?.forEach((attr) => {
            attrs[attr.Name] = attr.Value;
          });
          resolve(attrs);
        }
      });
    });
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Get ID token
   */
  getIdToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.idToken || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens) {
      return false;
    }

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Logout
   */
  logout(): void {
    const user = this.userPool.getCurrentUser();
    if (user) {
      user.signOut();
      this.clearTokens();

      // Redirect to Cognito logout
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        logout_uri: this.config.logoutUri,
      });
      window.location.href = `https://${this.config.domain}/logout?${params.toString()}`;
    }
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(): Promise<AuthTokens | null> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refreshToken) {
      return null;
    }

    const user = this.userPool.getCurrentUser();
    if (!user) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const refreshToken = new user.constructor.CognitoRefreshToken({
        RefreshToken: tokens.refreshToken,
      });

      user.refreshSession(refreshToken, (error, session) => {
        if (error) {
          reject(error);
        } else {
          const newTokens: AuthTokens = {
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
            refreshToken: session.getRefreshToken()?.getToken(),
          };
          this.storeTokens(newTokens);
          resolve(newTokens);
        }
      });
    });
  }

  // ========== Token Storage ==========

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  private getStoredTokens(): AuthTokens | null {
    const stored = localStorage.getItem('auth_tokens');
    return stored ? JSON.parse(stored) : null;
  }

  private clearTokens(): void {
    localStorage.removeItem('auth_tokens');
  }
}

// Create singleton instance
let authService: CognitoAuthService | null = null;

export function initializeCognitoAuth(config: CognitoConfig): CognitoAuthService {
  authService = new CognitoAuthService(config);
  return authService;
}

export function getAuthService(): CognitoAuthService {
  if (!authService) {
    throw new Error('Cognito auth service not initialized');
  }
  return authService;
}
