import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  expires_at: z.number(),
});

export type TokenData = z.infer<typeof TokenSchema>;

const CONFIG_DIR = join(process.env.HOME || '', '.argus');
const TOKEN_FILE = join(CONFIG_DIR, 'tokens.json');

export class OAuthManager {
  private appId: string;
  private appSecret: string;
  private redirectUri: string;
  private port: number;

  constructor() {
    this.appId = process.env.APP_ID || '';
    this.appSecret = process.env.APP_SECRET || '';
    this.port = parseInt(process.env.PORT || '3698', 10);
    this.redirectUri = process.env.REDIRECT_URI || `http://localhost:${this.port}/auth`;

    if (!this.appId || !this.appSecret) {
      throw new Error('APP_ID and APP_SECRET must be set in environment variables');
    }
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      state,
      response_type: 'code',
      redirect_uri: this.redirectUri,
    });
    
    return `https://secure.helpscout.net/authentication/authorizeClientApplication?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<TokenData> {
    const response = await fetch('https://api.helpscout.net/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.appId,
        client_secret: this.appSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const data = await response.json();
    const tokenData = {
      ...data,
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    await this.saveTokens(tokenData);
    return tokenData;
  }

  async refreshAccessToken(): Promise<TokenData> {
    const tokens = await this.loadTokens();
    
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    const response = await fetch('https://api.helpscout.net/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    const tokenData = {
      ...data,
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    await this.saveTokens(tokenData);
    return tokenData;
  }

  async getValidToken(): Promise<string> {
    const tokens = await this.loadTokens();
    
    if (!tokens) {
      throw new Error('No tokens found. Please authenticate first.');
    }

    if (Date.now() >= tokens.expires_at - 60000) {
      console.log(chalk.gray('Token expired, refreshing...'));
      const refreshed = await this.refreshAccessToken();
      return refreshed.access_token;
    }

    return tokens.access_token;
  }

  async startAuthServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const state = Math.random().toString(36).substring(7);
      const authUrl = this.getAuthorizationUrl(state);
      
      console.log(chalk.cyan('\n🔐 Starting OAuth authentication server...'));
      console.log(chalk.yellow('Please visit this URL to authenticate:'));
      console.log(chalk.blue.underline(authUrl));
      console.log(chalk.gray(`\nWaiting for callback on port ${this.port}...`));

      const server = Bun.serve({
        port: this.port,
        async fetch(req) {
          const url = new URL(req.url);
          
          if (url.pathname === '/auth') {
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            
            if (returnedState !== state) {
              server.stop();
              reject(new Error('State mismatch - possible CSRF attack'));
              return new Response('Authentication failed: State mismatch', { status: 400 });
            }
            
            if (!code) {
              server.stop();
              reject(new Error('No authorization code received'));
              return new Response('Authentication failed: No code received', { status: 400 });
            }

            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: system-ui; padding: 40px; text-align: center; }
                  .success { color: #10b981; }
                </style>
              </head>
              <body>
                <h1 class="success">✅ Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
              </html>
            `;
            
            setTimeout(() => {
              server.stop();
              resolve(code);
            }, 100);
            
            return new Response(html, {
              headers: { 'Content-Type': 'text/html' },
            });
          }
          
          return new Response('Not found', { status: 404 });
        },
      });
    });
  }

  private async saveTokens(tokens: TokenData): Promise<void> {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  }

  private async loadTokens(): Promise<TokenData | null> {
    if (!existsSync(TOKEN_FILE)) {
      return null;
    }
    
    try {
      const content = await readFile(TOKEN_FILE, 'utf-8');
      const data = JSON.parse(content);
      return TokenSchema.parse(data);
    } catch (error) {
      console.error(chalk.red('Error loading tokens:'), error);
      return null;
    }
  }
}