import { Configuration, ConfidentialClientApplication, LogLevel, AccountInfo } from '@azure/msal-node';
import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import connectPg from 'connect-pg-simple';
import { storage } from './storage';
import { pool } from './db';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        displayName: string;
        role: string;
        entraId: string;
      };
    }
  }
}

// MSAL configuration setup
const clientId = process.env.ENTRA_CLIENT_ID;
const tenantId = process.env.ENTRA_TENANT_ID;
const clientSecret = process.env.ENTRA_CLIENT_SECRET;

// Initialize MSAL client if credentials are available
let msalClient: ConfidentialClientApplication | null = null;
if (clientId && tenantId && clientSecret) {
  try {
    const msalConfig: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback(loglevel, message) {
            console.log(message);
          },
          piiLoggingEnabled: false,
          logLevel: LogLevel.Info,
        },
      },
    };
    msalClient = new ConfidentialClientApplication(msalConfig);
    console.log('[EntraID Auth] MSAL client initialized successfully');
  } catch (error) {
    console.error('[EntraID Auth] Failed to initialize MSAL client:', error);
    msalClient = null;
  }
}

// Set up session store
const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({
  pool,
  tableName: 'session',
  createTableIfMissing: false,
});

// Configure auth routes and middleware
export function setupAuth(app: Express) {
  // Session configuration
  app.use(cookieParser());
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && !process.env.REPLIT_ENVIRONMENT,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
    }
  }));

  // Authentication Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.session && (req.session as any).account) {
      req.user = {
        id: (req.session as any).userId || 0,
        email: (req.session as any).account.username || '',
        displayName: (req.session as any).account.name || '',
        role: (req.session as any).userRole || 'PROJECT_USER',
        entraId: (req.session as any).account.homeAccountId || '',
      };
    }
    next();
  });

  // Login route
  app.get("/auth/login", async (req: Request, res: Response) => {
    if (!msalClient) {
      return res.status(500).send("Microsoft authentication is not configured");
    }

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const authCodeUrlParameters = {
      scopes: ["User.Read"],
      redirectUri: `${appUrl}/auth/callback`,
    };

    try {
      const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
      res.redirect(authUrl);
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).send("Error during login");
    }
  });

  // Callback route
  app.get("/auth/callback", async (req: Request, res: Response) => {
    if (!msalClient) {
      return res.status(500).send("Microsoft authentication is not configured");
    }

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const tokenRequest = {
      code: req.query.code as string,
      scopes: ["User.Read"],
      redirectUri: `${appUrl}/auth/callback`,
    };

    try {
      const response = await msalClient.acquireTokenByCode(tokenRequest);
      if (!response.account) {
        return res.status(500).send("No account information received");
      }

      // Store user in session
      (req.session as any).account = response.account;
      (req.session as any).accessToken = response.accessToken;

      // Check if user exists in the database
      const userFromDb = await storage.getUserByEntraId(response.account.homeAccountId);

      if (userFromDb) {
        // Update last login timestamp
        await storage.updateUserLastLogin(userFromDb.id);
        (req.session as any).userId = userFromDb.id;
        (req.session as any).userRole = userFromDb.role || 'PROJECT_USER';
      } else {
        // Create new user
        try {
          const username = response.account.username ||
            response.account.name?.replace(/\s+/g, '.').toLowerCase() ||
            'user' + Date.now();
          
          const newUser = await storage.createUser({
            username,
            displayName: response.account.name || '',
            email: response.account.username || '',
            entraId: response.account.homeAccountId,
            role: 'PROJECT_USER',
          });
          (req.session as any).userId = newUser.id;
          (req.session as any).userRole = 'PROJECT_USER';
        } catch (error) {
          console.error("Error creating user:", error);
          return res.status(500).send("Error creating user account");
        }
      }


      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('[Auth Callback] Session save error:', err);
        }
        // Redirect to dashboard/home
        res.redirect('/');
      });
    } catch (error) {
      console.error("Error during token acquisition:", error);
      res.status(500).send("Error during authentication");
    }
  });

  // Logout route
  app.get("/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      if (tenantId) {
        const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
        res.redirect(logoutUrl);
      } else {
        res.redirect('/login');
      }
    });
  });

  // Authentication status endpoint
  app.get("/api/auth/status", (req: Request, res: Response) => {
    if (req.session && (req.session as any).account) {
      res.json({
        authenticated: true,
        user: {
          id: (req.session as any).userId,
          displayName: (req.session as any).account.name,
          email: (req.session as any).account.username,
          role: (req.session as any).userRole,
          oid: (req.session as any).account.localAccountId
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  });
}

// Authentication middleware for protected routes
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session && (req.session as any).account) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}