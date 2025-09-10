# AWS Cognito Integration with Node-RED

This guide shows how to integrate Node-RED with AWS Cognito OAuth 2.0 authentication.

## Prerequisites

1. AWS Cognito User Pool configured
2. App Client created in Cognito with OAuth flows enabled
3. Node-RED instance with authentication enabled

## Required NPM Packages

```bash
npm install passport-oauth2
# or for more specific OIDC support
npm install passport-openidconnect
```

## Reference Implementation

This guide is based on the proven approach from [this StackOverflow discussion](https://stackoverflow.com/questions/67242736/how-to-use-aws-cognito-as-a-provider-in-passport) which demonstrates using AWS Cognito with Passport.js through the generic OAuth2 strategy.

## Configuration Examples

### Recommended Approach: StackOverflow-Proven Method

Based on the StackOverflow reference, here's the most reliable configuration using Cognito's hosted UI:

```javascript
// In your Node-RED settings.js
adminAuth: {
    type: "strategy",
    strategy: {
        name: "cognito",
        label: "Sign in with Company Account",
        icon: "fa-aws",
        strategy: require("passport-oauth2").Strategy,
        options: {
            authorizationURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize',
            tokenURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/token',
            clientID: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            callbackURL: 'http://localhost:1880/auth/strategy/callback',
            scope: ['openid', 'email', 'profile'],
            
            // Key insight from StackOverflow: Use Cognito's hosted UI
            // This provides a complete, branded authentication experience
            state: true, // Enable state parameter for security
            
            // Custom headers for Cognito compatibility
            customHeaders: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        },
        
        // User profile extraction - the critical part from the SO reference
        verify: function(accessToken, refreshToken, params, profile, done) {
            // Cognito returns user info in the ID token (params.id_token)
            // or we need to call the userInfo endpoint
            
            const https = require('https');
            const options = {
                hostname: 'your-cognito-domain.auth.us-east-1.amazoncognito.com',
                path: '/oauth2/userInfo',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const userInfo = JSON.parse(data);
                        
                        // Map Cognito user to Node-RED user (similar to SO findOrCreate pattern)
                        const user = {
                            username: userInfo.email || userInfo['cognito:username'],
                            permissions: mapCognitoToNodeRedPermissions(userInfo),
                            email: userInfo.email,
                            name: userInfo.name,
                            // Store Cognito subject for future reference
                            cognitoSub: userInfo.sub,
                            groups: userInfo['cognito:groups'] || []
                        };
                        
                        console.log('Cognito user authenticated:', user.username);
                        done(null, user);
                        
                    } catch (error) {
                        console.error('Error parsing user info:', error);
                        done(error, null);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('Error fetching user info:', error);
                done(error, null);
            });
            
            req.end();
        }
    }
}

// Permission mapping function (inspired by SO findOrCreate pattern)
function mapCognitoToNodeRedPermissions(userInfo) {
    const groups = userInfo['cognito:groups'] || [];
    const email = userInfo.email || '';
    
    // Admin access for specific groups or domains
    if (groups.includes('node-red-admins') || email.endsWith('@yourcompany.com')) {
        return "*";
    }
    
    // Editor access
    if (groups.includes('node-red-editors')) {
        return ["flows.read", "flows.write", "nodes.read"];
    }
    
    // Default read-only access
    return "read";
}
```

### Option 1: Generic OAuth2 Strategy (Alternative Implementation)

```javascript
// In your Node-RED settings.js
adminAuth: {
    type: "strategy",
    strategy: {
        name: "cognito",
        label: "Sign in with AWS Cognito",
        icon: "fa-aws",
        strategy: require("passport-oauth2").Strategy,
        options: {
            authorizationURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize',
            tokenURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/token',
            clientID: 'your-cognito-app-client-id',
            clientSecret: 'your-cognito-app-client-secret',
            callbackURL: 'http://localhost:1880/auth/strategy/callback',
            scope: ['openid', 'email', 'profile'],
            
            // Custom user profile retrieval
            profileURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/userInfo',
            
            customHeaders: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        },
        
        // Custom user verification and mapping
        verify: function(accessToken, refreshToken, profile, done) {
            // Option 1: Direct profile mapping
            if (profile && profile.email) {
                const user = {
                    username: profile.email,
                    permissions: determinePermissions(profile),
                    image: profile.picture,
                    email: profile.email,
                    name: profile.name
                };
                done(null, user);
            } else {
                // Option 2: Decode JWT token for more info
                const jwt = require('jsonwebtoken');
                try {
                    const decodedToken = jwt.decode(accessToken);
                    const user = {
                        username: decodedToken.email || decodedToken['cognito:username'],
                        permissions: mapCognitoGroupsToPermissions(decodedToken['cognito:groups']),
                        email: decodedToken.email,
                        name: decodedToken.name || decodedToken.given_name + ' ' + decodedToken.family_name
                    };
                    done(null, user);
                } catch (error) {
                    done(error, null);
                }
            }
        }
    }
}

// Helper function to determine permissions based on Cognito groups
function mapCognitoGroupsToPermissions(groups) {
    if (!groups || !Array.isArray(groups)) {
        return "read"; // Default read-only access
    }
    
    if (groups.includes('node-red-admin')) {
        return "*"; // Full access
    } else if (groups.includes('node-red-editor')) {
        return ["flows.read", "flows.write", "nodes.read"];
    } else if (groups.includes('node-red-viewer')) {
        return "read";
    }
    
    return "read"; // Default fallback
}

function determinePermissions(profile) {
    // Map based on email domain, custom attributes, etc.
    if (profile.email.endsWith('@yourcompany.com')) {
        return "*";
    }
    return "read";
}
```

### Option 2: OpenID Connect Strategy (More Complete)

```javascript
adminAuth: {
    type: "strategy",
    strategy: {
        name: "cognito-oidc",
        label: "Sign in with Company Account",
        icon: "fa-sign-in",
        strategy: require("passport-openidconnect").Strategy,
        options: {
            issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YourPoolId',
            authorizationURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize',
            tokenURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/token',
            userInfoURL: 'https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/userInfo',
            clientID: 'your-cognito-app-client-id',
            clientSecret: 'your-cognito-app-client-secret',
            callbackURL: 'http://localhost:1880/auth/strategy/callback',
            scope: ['openid', 'email', 'profile'],
            
            // OIDC specific options
            skipUserProfile: false,
            passReqToCallback: false
        },
        
        verify: function(issuer, sub, profile, accessToken, refreshToken, done) {
            // More detailed OIDC profile handling
            const user = {
                username: profile.email || profile.preferred_username,
                permissions: mapCognitoRolesToPermissions(profile),
                email: profile.email,
                name: profile.name,
                image: profile.picture,
                // Store additional Cognito attributes
                cognitoSub: sub,
                cognitoGroups: profile['cognito:groups'] || []
            };
            
            done(null, user);
        }
    }
}

function mapCognitoRolesToPermissions(profile) {
    const groups = profile['cognito:groups'] || [];
    const customAttributes = profile['custom:role'] || '';
    
    // Priority-based permission mapping
    if (groups.includes('Admins') || customAttributes === 'admin') {
        return "*";
    }
    
    if (groups.includes('Editors') || customAttributes === 'editor') {
        return ["flows.read", "flows.write", "nodes.read", "context.read"];
    }
    
    if (groups.includes('Developers')) {
        return ["flows.read", "nodes.read", "context.read", "settings.read"];
    }
    
    // Default read-only access
    return "read";
}
```

### Option 3: Custom Cognito Integration with JWT Validation

```javascript
// For more control, you can implement custom JWT validation
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// JWKS client for Cognito
const client = jwksClient({
    jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YourPoolId/.well-known/jwks.json'
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

adminAuth: {
    type: "credentials",
    users: function(username) {
        // Custom user lookup - could integrate with Cognito Admin APIs
        return Promise.resolve(null); // Let authentication handle this
    },
    
    // Custom token authentication for API access
    tokens: function(token) {
        return new Promise((resolve, reject) => {
            // Verify JWT token from Cognito
            jwt.verify(token, getKey, {
                audience: 'your-cognito-app-client-id',
                issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YourPoolId',
                algorithms: ['RS256']
            }, (err, decoded) => {
                if (err) {
                    resolve(null);
                    return;
                }
                
                const user = {
                    username: decoded.email || decoded['cognito:username'],
                    permissions: mapCognitoTokenToPermissions(decoded),
                    email: decoded.email,
                    tokenType: 'cognito-jwt'
                };
                
                resolve(user);
            });
        });
    },
    
    tokenHeader: "authorization" // Bearer token in Authorization header
}

function mapCognitoTokenToPermissions(decodedToken) {
    const groups = decodedToken['cognito:groups'] || [];
    const scope = decodedToken.scope ? decodedToken.scope.split(' ') : [];
    
    // Map based on Cognito groups and scopes
    if (groups.includes('node-red-admin') || scope.includes('admin')) {
        return "*";
    }
    
    if (groups.includes('node-red-editor') || scope.includes('editor')) {
        return ["flows.read", "flows.write", "nodes.read"];
    }
    
    return "read";
}
```

## AWS Cognito Configuration

### 1. Create User Pool

```bash
# Via AWS CLI
aws cognito-idp create-user-pool \
    --pool-name "NodeRedUsers" \
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true}" \
    --auto-verified-attributes email \
    --username-attributes email
```

### 2. Create App Client

```bash
aws cognito-idp create-user-pool-client \
    --user-pool-id us-east-1_YourPoolId \
    --client-name "NodeRedApp" \
    --generate-secret \
    --supported-identity-providers "COGNITO" \
    --callback-urls "http://localhost:1880/auth/strategy/callback" \
    --logout-urls "http://localhost:1880" \
    --allowed-o-auth-flows "code" \
    --allowed-o-auth-scopes "openid" "email" "profile" \
    --allowed-o-auth-flows-user-pool-client
```

### 3. Configure Hosted UI Domain

```bash
aws cognito-idp create-user-pool-domain \
    --user-pool-id us-east-1_YourPoolId \
    --domain your-unique-domain-name
```

### 4. Create User Groups for Authorization

```bash
# Admin group
aws cognito-idp create-group \
    --group-name "node-red-admin" \
    --user-pool-id us-east-1_YourPoolId \
    --description "Node-RED Administrators"

# Editor group
aws cognito-idp create-group \
    --group-name "node-red-editor" \
    --user-pool-id us-east-1_YourPoolId \
    --description "Node-RED Editors"

# Viewer group
aws cognito-idp create-group \
    --group-name "node-red-viewer" \
    --user-pool-id us-east-1_YourPoolId \
    --description "Node-RED Viewers"
```

## Environment Variables Setup

```bash
# Create .env file for sensitive data
NODE_RED_COGNITO_CLIENT_ID=your-cognito-app-client-id
NODE_RED_COGNITO_CLIENT_SECRET=your-cognito-app-client-secret
NODE_RED_COGNITO_DOMAIN=your-cognito-domain.auth.us-east-1.amazoncognito.com
NODE_RED_COGNITO_POOL_ID=us-east-1_YourPoolId
NODE_RED_COGNITO_REGION=us-east-1
```

```javascript
// In settings.js, use environment variables
const cognitoDomain = process.env.NODE_RED_COGNITO_DOMAIN;
const cognitoClientId = process.env.NODE_RED_COGNITO_CLIENT_ID;
const cognitoClientSecret = process.env.NODE_RED_COGNITO_CLIENT_SECRET;

adminAuth: {
    type: "strategy",
    strategy: {
        // ... rest of configuration using environment variables
        options: {
            authorizationURL: `https://${cognitoDomain}/oauth2/authorize`,
            tokenURL: `https://${cognitoDomain}/oauth2/token`,
            clientID: cognitoClientId,
            clientSecret: cognitoClientSecret,
            // ...
        }
    }
}
```

## Advanced Features

### 1. Multi-Factor Authentication Support

```javascript
// Cognito supports MFA - the JWT token will include MFA confirmation
verify: function(accessToken, refreshToken, profile, done) {
    const jwt = require('jsonwebtoken');
    const decodedToken = jwt.decode(accessToken);
    
    // Check MFA status
    const mfaVerified = decodedToken['cognito:mfa_enabled'] === 'true' && 
                       decodedToken['auth_time'];
    
    const user = {
        username: profile.email,
        permissions: mfaVerified ? 
            mapToFullPermissions(profile) : 
            "read", // Limited permissions without MFA
        mfaEnabled: mfaVerified
    };
    
    done(null, user);
}
```

### 2. Custom Attributes Integration

```javascript
// Map custom Cognito attributes to Node-RED permissions
verify: function(accessToken, refreshToken, profile, done) {
    const user = {
        username: profile.email,
        permissions: mapCustomAttributesToPermissions(profile),
        department: profile['custom:department'],
        role: profile['custom:role'],
        accessLevel: profile['custom:access_level']
    };
    
    done(null, user);
}

function mapCustomAttributesToPermissions(profile) {
    const accessLevel = profile['custom:access_level'];
    const department = profile['custom:department'];
    
    if (accessLevel === 'admin') return "*";
    if (accessLevel === 'editor' && department === 'engineering') {
        return ["flows.read", "flows.write", "nodes.read", "nodes.write"];
    }
    if (accessLevel === 'editor') {
        return ["flows.read", "flows.write"];
    }
    
    return "read";
}
```

### 3. Session Management with Cognito Tokens

```javascript
// Store Cognito refresh tokens for session management
adminAuth: {
    type: "strategy",
    strategy: {
        // ... configuration
        verify: function(accessToken, refreshToken, profile, done) {
            const user = {
                username: profile.email,
                permissions: mapToPermissions(profile),
                // Store tokens for later use
                cognitoAccessToken: accessToken,
                cognitoRefreshToken: refreshToken,
                tokenExpiry: Date.now() + 3600000 // 1 hour
            };
            
            done(null, user);
        }
    },
    
    // Custom session expiry handling
    sessionExpiryTime: 3600, // 1 hour to match Cognito token
    
    // Optional: Refresh token handling
    onSessionExpiry: function(session) {
        // Could implement token refresh logic here
        console.log('Session expired for user:', session.user);
    }
}
```

## Testing the Integration

### 1. Test Configuration

```javascript
// Add to your dev-settings.js for testing
module.exports = {
    // ... existing configuration
    
    // Test Cognito integration
    adminAuth: {
        type: "strategy",
        strategy: {
            name: "cognito",
            label: "Sign in with Cognito",
            strategy: require("passport-oauth2").Strategy,
            options: {
                authorizationURL: `https://${process.env.NODE_RED_COGNITO_DOMAIN}/oauth2/authorize`,
                tokenURL: `https://${process.env.NODE_RED_COGNITO_DOMAIN}/oauth2/token`,
                clientID: process.env.NODE_RED_COGNITO_CLIENT_ID,
                clientSecret: process.env.NODE_RED_COGNITO_CLIENT_SECRET,
                callbackURL: 'http://localhost:1880/auth/strategy/callback',
                scope: ['openid', 'email', 'profile']
            },
            verify: function(accessToken, refreshToken, profile, done) {
                console.log('Cognito profile:', profile);
                console.log('Access token:', accessToken);
                
                const user = {
                    username: profile.email || 'test-user',
                    permissions: "*", // Full access for testing
                    email: profile.email
                };
                
                done(null, user);
            }
        }
    },
    
    // Enhanced logging for debugging
    logging: {
        console: {
            level: "debug",
            metrics: true,
            audit: true
        }
    }
}
```

### 2. Testing Steps

1. Start Node-RED with your Cognito configuration
2. Navigate to `http://localhost:1880`
3. Click "Sign in with Cognito"
4. Complete OAuth flow in Cognito Hosted UI
5. Verify successful authentication and correct permissions

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Ensure callback URL matches exactly in Cognito App Client
   - Check for trailing slashes, protocol mismatches

2. **Token Validation Errors**
   - Verify JWKS endpoint accessibility
   - Check token expiration times
   - Validate audience and issuer claims

3. **Permission Mapping Issues**
   - Log profile data to understand Cognito response structure
   - Test group membership and custom attributes
   - Verify scope permissions in Cognito

4. **HTTPS Requirements**
   - Production Cognito requires HTTPS
   - Use ngrok or similar for local HTTPS testing

This integration provides enterprise-grade authentication with AWS Cognito's full feature set including MFA, user management, and compliance features.