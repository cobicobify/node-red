# Node-RED Authentication & Authorization Deep Dive

This document provides an in-depth analysis of Node-RED's authentication and authorization system, based on comprehensive code analysis.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Authentication Flow](#authentication-flow)
4. [Authorization System](#authorization-system)
5. [Session Management](#session-management)
6. [Security Features](#security-features)
7. [Configuration Examples](#configuration-examples)
8. [Security Considerations](#security-considerations)

## Architecture Overview

Node-RED implements a sophisticated multi-layered authentication and authorization system built on top of **Passport.js** and **OAuth2orize**. The system is designed to be modular, extensible, and secure.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NODE-RED EDITOR                             │
├─────────────────────────────────────────────────────────────────────┤
│                    Express.js Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                   Authentication Middleware                        │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────────┐ │
│  │ Bearer Token  │ │ User Tokens   │ │   Anonymous Access        │ │
│  │   Strategy    │ │   Strategy    │ │      Strategy             │ │
│  └───────────────┘ └───────────────┘ └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    Authorization Layer                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │            Permission Checking System                          │ │
│  │  • Read/Write Permissions                                      │ │
│  │  • Granular API Access Control                                │ │
│  │  • Wildcard Permission Support                                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      Session Management                            │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────────┐ │
│  │     Tokens    │ │     Users     │ │        Clients            │ │
│  │   Management  │ │   Management  │ │      Management           │ │
│  └───────────────┘ └───────────────┘ └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication Module (`/auth/index.js`)

The main authentication orchestrator that:
- Initializes Passport strategies
- Sets up OAuth2 server
- Manages login/logout flows
- Handles different authentication types

**Key Functions:**
- `needsPermission(permission)` - Middleware for permission checking
- `login()` - Handles login request and returns appropriate prompts
- `revoke()` - Handles logout and token revocation
- `genericStrategy()` - Sets up OAuth2 strategies (GitHub, Google, etc.)

### 2. Authentication Strategies (`/auth/strategies.js`)

Implements multiple Passport.js strategies:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION STRATEGIES                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Bearer Strategy │    │ Token Strategy  │    │ Anonymous       │  │
│  │                 │    │                 │    │ Strategy        │  │
│  │ • OAuth tokens  │    │ • Custom tokens │    │ • Default user  │  │
│  │ • Session-based │    │ • Header-based  │    │ • No auth req   │  │
│  │ • Auto-expire   │    │ • User-defined  │    │ • Read-only     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ Password Token  │    │ Client Password │                        │
│  │ Exchange        │    │ Strategy        │                        │
│  │                 │    │                 │                        │
│  │ • Username/pwd  │    │ • OAuth2 client │                        │
│  │ • Rate limiting │    │ • Client auth   │                        │
│  │ • Audit logging │    │ • Fixed secrets │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Bearer Strategy
```javascript
// Validates OAuth2 bearer tokens
// Flow: Header Token -> Token Validation -> User Lookup -> Authorization
```

#### Token Strategy
```javascript
// Handles custom user-defined tokens
// Flow: Custom Header -> Token Function -> User Object -> Permissions
```

#### Anonymous Strategy
```javascript
// Allows anonymous access with limited permissions
// Flow: No Auth -> Default User -> Read-Only Access
```

#### Password Token Exchange
```javascript
// Handles username/password authentication
// Features:
// - Rate limiting (5 attempts per 10 minutes)
// - BCrypt password verification
// - Audit logging
// - Token generation
```

### 3. User Management (`/auth/users.js`)

Handles user authentication and management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Authentication Methods:                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  1. Credentials (username/password)                            │ │
│  │     • BCrypt password hashing                                  │ │
│  │     • Static user list or function-based                      │ │
│  │                                                                │ │
│  │  2. OAuth Strategies                                           │ │
│  │     • GitHub, Google, Twitter, etc.                           │ │
│  │     • Profile extraction and mapping                          │ │
│  │                                                                │ │
│  │  3. Custom Authentication                                      │ │
│  │     • Function-based user lookup                              │ │
│  │     • LDAP, database integration                              │ │
│  │                                                                │ │
│  │  4. Token-based Authentication                                 │ │
│  │     • Custom token validation function                        │ │
│  │     • Header-based token passing                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**User Object Structure:**
```javascript
{
  username: "admin",
  password: "$2a$08$...", // BCrypt hash
  permissions: "*",        // Permission scope
  image: "...",           // Optional profile image
  // ... other custom properties
}
```

### 4. Permission System (`/auth/permissions.js`)

Node-RED implements a flexible permission system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PERMISSION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Permission Hierarchy:                                             │
│                                                                     │
│  "*"                    - Full access (admin)                      │
│  │                                                                 │
│  ├─ "read"              - Global read access                       │
│  │  ├─ "flows.read"     - Read flows                             │
│  │  ├─ "nodes.read"     - Read node catalog                      │
│  │  ├─ "context.read"   - Read context data                      │
│  │  └─ "settings.read"  - Read settings                          │
│  │                                                                 │
│  ├─ "write"             - Global write access                      │
│  │  ├─ "flows.write"    - Modify flows                           │
│  │  ├─ "nodes.write"    - Install/remove nodes                   │
│  │  ├─ "context.write"  - Modify context data                    │
│  │  └─ "settings.write" - Modify settings                        │
│  │                                                                 │
│  └─ "*.read"/"*.write"  - Wildcard permissions                    │
│                                                                     │
│  Array Permissions: ["flows.read", "nodes.read", ...]             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Permission Checking Logic:**
```javascript
function hasPermission(userScope, permission) {
    // 1. Empty permission always allowed
    if (permission === "") return true;
    
    // 2. Array permissions - check each one
    if (Array.isArray(permission)) {
        return permission.every(p => hasPermission(userScope, p));
    }
    
    // 3. Array user scope - check if any scope matches
    if (Array.isArray(userScope)) {
        return userScope.some(scope => hasPermission(scope, permission));
    }
    
    // 4. Wildcard or exact match
    if (userScope === "*" || userScope === permission) return true;
    
    // 5. Read/write hierarchy
    if (userScope === "read" || userScope === "*.read") {
        return /^((.+)\.)?read$/.test(permission);
    }
    if (userScope === "write" || userScope === "*.write") {
        return /^((.+)\.)?write$/.test(permission);
    }
    
    return false;
}
```

### 5. Token Management (`/auth/tokens.js`)

Sophisticated session and token management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TOKEN MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Token Types:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  1. Session Tokens (OAuth2)                                    │ │
│  │     • 128-byte random tokens                                   │ │
│  │     • Configurable expiry (default: 1 week)                   │ │
│  │     • Persistent storage                                       │ │
│  │     • Automatic cleanup                                        │ │
│  │                                                                │ │
│  │  2. API Access Tokens                                          │ │
│  │     • Pre-configured static tokens                            │ │
│  │     • No expiration                                           │ │
│  │     • Direct scope assignment                                 │ │
│  │                                                                │ │
│  │  3. User-defined Tokens                                        │ │
│  │     • Custom token validation                                  │ │
│  │     • External integration                                     │ │
│  │     • Function-based token handling                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Token Structure:                                                  │
│  {                                                                 │
│    user: "username",                                               │
│    client: "node-red-editor",                                      │
│    scope: "*",                                                     │
│    accessToken: "base64-encoded-token",                            │
│    expires: timestamp                                              │
│  }                                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Session Expiry Management:**
- Automatic cleanup of expired sessions
- Configurable expiry time
- Grace period for cleanup (5 seconds)
- Listener system for expiry events
- Persistent storage integration

### 6. OAuth2 Client Management (`/auth/clients.js`)

Simple but effective OAuth2 client management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      OAUTH2 CLIENTS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pre-configured Clients:                                           │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • node-red-editor                                             │ │
│  │    - Main editor client                                        │ │
│  │    - Secret: "not_available"                                   │ │
│  │                                                                │ │
│  │  • node-red-admin                                              │ │
│  │    - Administrative client                                     │ │
│  │    - Secret: "not_available"                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Client Authentication:                                            │
│  • OAuth2 client password strategy                                │
│  • Fixed client secrets (simplified for embedded use)             │
│  • Client ID validation                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### 1. Initial Login Process

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOGIN FLOW DIAGRAM                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

User Access               Node-RED Editor            Authentication System
     │                           │                            │
     │ 1. Access /               │                            │
     ├──────────────────────────►│                            │
     │                           │ 2. Check auth required    │
     │                           ├───────────────────────────►│
     │                           │ 3. Redirect to login      │
     │                           │◄───────────────────────────┤
     │ 4. GET /auth/login        │                            │
     ├──────────────────────────►│                            │
     │                           │ 5. Determine auth type    │
     │                           ├───────────────────────────►│
     │                           │ 6. Return login prompts   │
     │                           │◄───────────────────────────┤
     │ 7. Login form/OAuth       │                            │
     │◄──────────────────────────┤                            │
     │                           │                            │
     │ 8. Submit credentials     │                            │
     ├──────────────────────────►│                            │
     │                           │ 9. Validate credentials   │
     │                           ├───────────────────────────►│
     │                           │ 10. Create session token  │
     │                           │◄───────────────────────────┤
     │ 11. Redirect with token   │                            │
     │◄──────────────────────────┤                            │
     │                           │                            │
```

### 2. API Request Authentication

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        API AUTHENTICATION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

API Client               Admin API                   Auth Middleware
    │                       │                              │
    │ 1. API Request        │                              │
    │ Bearer token/header   │                              │
    ├──────────────────────►│                              │
    │                       │ 2. needsPermission()         │
    │                       ├─────────────────────────────►│
    │                       │                              │ 3. Passport auth
    │                       │                              │ ['bearer','tokens','anon']
    │                       │                              │
    │                       │                              │ 4. Strategy execution:
    │                       │                              │ • Bearer -> Token lookup
    │                       │                              │ • Tokens -> Custom validation
    │                       │                              │ • Anon   -> Default user
    │                       │                              │
    │                       │ 5. User + permissions       │
    │                       │◄─────────────────────────────┤
    │                       │ 6. Check permission          │
    │                       ├─────────────────────────────►│
    │                       │ 7. Allow/Deny               │
    │                       │◄─────────────────────────────┤
    │ 8. API Response       │                              │
    │ or 401 Unauthorized   │                              │
    │◄──────────────────────┤                              │
    │                       │                              │
```

## Authorization System

### Permission Matrix

| User Scope | flows.read | flows.write | nodes.read | nodes.write | context.read | context.write | settings.read |
|------------|------------|-------------|------------|-------------|--------------|---------------|---------------|
| "*" | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| "read" | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| "write" | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| "*.read" | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| "flows.read" | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ["flows.read", "nodes.read"] | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Admin API Endpoints & Required Permissions

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN API PERMISSIONS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Flow Management:                                                   │
│  GET    /flows           → flows.read                               │
│  POST   /flows           → flows.write                              │
│  GET    /flows/state     → flows.read                               │
│  POST   /flows/state     → flows.write                              │
│  GET    /flow/:id        → flows.read                               │
│  POST   /flow            → flows.write                              │
│  PUT    /flow/:id        → flows.write                              │
│  DELETE /flow/:id        → flows.write                              │
│                                                                     │
│  Node Management:                                                   │
│  GET    /nodes           → nodes.read                               │
│  POST   /nodes           → nodes.write                              │
│  GET    /nodes/messages  → nodes.read                               │
│  PUT    /nodes/:module   → nodes.write                              │
│  DELETE /nodes/:module   → nodes.write                              │
│                                                                     │
│  Context Management:                                                │
│  GET    /context/*       → context.read                             │
│  DELETE /context/*       → context.write                            │
│                                                                     │
│  Settings:                                                          │
│  GET    /settings        → settings.read                            │
│                                                                     │
│  Plugins:                                                           │
│  GET    /plugins         → plugins.read                             │
│                                                                     │
│  Diagnostics:                                                       │
│  GET    /diagnostics     → diagnostics.read                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Session Management

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SESSION LIFECYCLE                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

Login Success            Token Creation              Session Storage
     │                        │                           │
     │ 1. Authentication OK   │                           │
     ├───────────────────────►│                           │
     │                        │ 2. Generate random token │
     │                        │    (128 bytes, base64)   │
     │                        │                           │
     │                        │ 3. Set expiry time       │
     │                        │    (default: 1 week)     │
     │                        │                           │
     │                        │ 4. Create session object │
     │                        │    {user, client, scope,  │
     │                        │     token, expires}       │
     │                        │                           │
     │                        │ 5. Store session         │
     │                        ├──────────────────────────►│
     │                        │                           │ 6. Persist to storage
     │                        │                           │    (filesystem/database)
     │                        │                           │
     │                        │ 7. Schedule expiry        │
     │                        │◄──────────────────────────┤
     │ 8. Return access token │                           │
     │◄───────────────────────┤                           │
     │                        │                           │

Session Usage            Token Validation            Expiry Management
     │                        │                           │
     │ 1. API request         │                           │
     │ with bearer token      │                           │
     ├───────────────────────►│                           │
     │                        │ 2. Lookup session        │
     │                        ├──────────────────────────►│
     │                        │ 3. Check expiry          │
     │                        │◄──────────────────────────┤
     │                        │ 4. Return user/scope     │
     │                        │   or null if expired     │
     │ 5. Access granted/     │                           │
     │    denied              │                           │
     │◄───────────────────────┤                           │
     │                        │                           │
     │                        │                           │ Automatic Cleanup
     │                        │                           │     │
     │                        │                           │ ┌───▼────────────┐
     │                        │                           │ │ Every session  │
     │                        │                           │ │ access or      │
     │                        │                           │ │ timeout event  │
     │                        │                           │ └────────────────┘
     │                        │                           │     │
     │                        │                           │ ┌───▼────────────┐
     │                        │                           │ │ Remove expired │
     │                        │                           │ │ sessions from  │
     │                        │                           │ │ memory & storage│
     │                        │                           │ └────────────────┘
     │                        │                           │
```

### Storage Integration

Node-RED's authentication system integrates with its storage layer:

- **Session Persistence**: Sessions survive server restarts
- **Configuration Storage**: User configurations stored securely
- **Flow Storage**: Flows protected by authentication
- **Context Storage**: Context data access controlled by permissions

## Security Features

### 1. Rate Limiting

**Login Attempt Limiting:**
```javascript
// Maximum 5 login attempts per username per 10-minute window
var loginSignInWindow = 600000; // 10 minutes
var maxAttempts = 5;

// Sliding window implementation
// Failed attempts tracked per username
// Automatic cleanup of old attempts
```

### 2. Password Security

**BCrypt Integration:**
```javascript
// Supports both @node-rs/bcrypt (native) and bcryptjs (fallback)
// Password hashing with configurable rounds
// Secure password comparison
// Password never stored in plaintext
```

### 3. Token Security

**Cryptographically Secure Tokens:**
```javascript
// 128-byte random tokens using crypto.randomBytes()
// Base64 encoding for safe transmission
// Automatic expiration
// Secure storage integration
```

### 4. Audit Logging

**Comprehensive Security Logging:**
```javascript
// All authentication events logged:
log.audit({event: "auth.login", user, username, scope});
log.audit({event: "auth.login.fail.credentials", username});
log.audit({event: "auth.login.fail.too-many-attempts", username});
log.audit({event: "auth.invalid-token"});
log.audit({event: "permission.fail", permissions});
```

### 5. Session Security

**Session Management Security:**
- Sessions stored server-side (not in client cookies)
- Automatic session cleanup
- Configurable session timeouts
- Secure session invalidation on logout
- Memory-based session storage with persistent backup

## Configuration Examples

### 1. Basic Credentials Authentication

```javascript
adminAuth: {
    type: "credentials",
    users: [
        {
            username: "admin",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.",
            permissions: "*"
        },
        {
            username: "editor",
            password: "$2a$08$...",
            permissions: ["flows.read", "flows.write", "nodes.read"]
        },
        {
            username: "viewer",
            password: "$2a$08$...",
            permissions: "read"
        }
    ]
}
```

### 2. GitHub OAuth Strategy

```javascript
adminAuth: {
    type: "strategy",
    strategy: {
        name: "github",
        label: "Sign in with GitHub",
        icon: "fa-github",
        strategy: require("passport-github").Strategy,
        options: {
            clientID: "your-github-client-id",
            clientSecret: "your-github-client-secret",
            callbackURL: "http://localhost:1880/auth/strategy/callback",
            scope: ["user:email"]
        },
        verify: function(accessToken, refreshToken, profile, done) {
            // Custom user verification logic
            // Map GitHub profile to Node-RED user
            done(null, {
                username: profile.username,
                permissions: "*",
                image: profile.photos[0].value
            });
        }
    }
}
```

### 3. Custom Authentication Function

```javascript
adminAuth: {
    type: "credentials",
    users: function(username) {
        // Custom user lookup (database, LDAP, etc.)
        return new Promise((resolve, reject) => {
            // Lookup user from external system
            database.getUser(username).then(user => {
                resolve({
                    username: user.username,
                    password: user.hashedPassword,
                    permissions: user.roles.includes('admin') ? "*" : "read"
                });
            }).catch(reject);
        });
    },
    authenticate: function(username, password) {
        // Custom authentication logic
        return new Promise((resolve, reject) => {
            // Validate against external system
            ldapClient.authenticate(username, password).then(result => {
                if (result.success) {
                    resolve({
                        username: username,
                        permissions: result.roles
                    });
                } else {
                    resolve(null);
                }
            }).catch(reject);
        });
    }
}
```

### 4. API Access Tokens

```javascript
adminAuth: {
    type: "credentials",
    users: [/* ... */],
    tokens: [
        {
            token: "your-secret-api-token-123",
            user: "api-user",
            scope: ["flows.read", "nodes.read"]
        }
    ],
    sessionExpiryTime: 86400  // 24 hours
}
```

### 5. Custom Token Authentication

```javascript
adminAuth: {
    type: "credentials",
    users: [/* ... */],
    tokens: function(token) {
        // Custom token validation
        return new Promise((resolve, reject) => {
            // Validate token against external service
            tokenService.validate(token).then(result => {
                if (result.valid) {
                    resolve({
                        username: result.user,
                        permissions: result.permissions
                    });
                } else {
                    resolve(null);
                }
            }).catch(reject);
        });
    },
    tokenHeader: "x-api-key"  // Custom header name
}
```

### 6. Anonymous Access with Restrictions

```javascript
adminAuth: {
    type: "credentials",
    users: [
        {
            username: "admin",
            password: "$2a$08$...",
            permissions: "*"
        }
    ],
    default: {
        permissions: "read"  // Anonymous users get read-only access
    }
}
```

## Security Considerations

### 1. **Password Storage**
- Always use BCrypt with appropriate rounds (minimum 8)
- Never store plaintext passwords
- Use strong, unique passwords

### 2. **Token Management**
- Regular token rotation for long-lived sessions
- Monitor token usage patterns
- Implement token revocation mechanisms

### 3. **Network Security**
- Use HTTPS in production
- Secure cookie settings
- CORS configuration

### 4. **Session Security**
- Configure appropriate session timeouts
- Implement session invalidation on suspicious activity
- Monitor session usage patterns

### 5. **Permission Design**
- Follow principle of least privilege
- Use granular permissions where possible
- Regular permission audits

### 6. **Audit and Monitoring**
- Enable audit logging
- Monitor authentication failures
- Set up alerts for security events
- Regular security reviews

### 7. **External Integration Security**
- Validate all external authentication responses
- Sanitize user profile data
- Implement proper error handling
- Secure credential storage for OAuth

## Conclusion

Node-RED's authentication and authorization system is a sophisticated, multi-layered security implementation that provides:

- **Flexibility** - Multiple authentication methods
- **Security** - Industry-standard security practices
- **Scalability** - Pluggable architecture for custom integrations
- **Usability** - Simple configuration for common use cases
- **Auditability** - Comprehensive logging and monitoring

The system balances security with usability, making it suitable for both development and production environments while maintaining the flexibility to integrate with existing authentication systems.