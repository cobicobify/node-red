/**
 * Development settings file for Node-RED.
 * Based on the default settings but configured for development.
 */

// Load environment variables
require('dotenv').config();

// Check if Cognito is configured
const cognitoConfigured = process.env.COGNITO_DOMAIN && 
                         process.env.COGNITO_CLIENT_ID && 
                         process.env.COGNITO_CLIENT_SECRET;

// Log authentication mode
if (cognitoConfigured) {
    console.log('🔐 Using AWS Cognito authentication');
    console.log(`   Domain: ${process.env.COGNITO_DOMAIN}`);
    console.log(`   Client ID: ${process.env.COGNITO_CLIENT_ID}`);
} else {
    console.log('🔐 Using fallback credentials authentication (admin/editor/viewer, password: "password")');
    console.log('   To enable Cognito, configure COGNITO_DOMAIN, COGNITO_CLIENT_ID, and COGNITO_CLIENT_SECRET in .env');
}

// Permission mapping function
function mapCognitoToNodeRedPermissions(userInfo) {
    const groups = userInfo['cognito:groups'] || [];
    const email = userInfo.email || '';
    
    console.log('Mapping permissions for user:', email, 'groups:', groups);
    
    // Admin access for specific groups or email domains
    if (groups.includes('node-red-admins') || email.endsWith('@yourcompany.com')) {
        return "*";
    }
    
    // Editor access
    if (groups.includes('node-red-editors')) {
        return ["flows.read", "flows.write", "nodes.read"];
    }
    
    // Default read-only access for authenticated users
    return "read";
}

module.exports = {
    // Use flows in project directory
    flowFile: 'dev-flows.json',
    
    // Authentication configuration - switches between Cognito and fallback
    adminAuth: cognitoConfigured ? {
        type: "strategy",
        strategy: {
            name: "oauth2", // Use oauth2 as the strategy name (Node-RED recognizes this)
            label: "Sign in with AWS Cognito",
            icon: "fa-sign-in-alt",
            strategy: require("passport-oauth2").Strategy,
            options: {
                authorizationURL: `https://${process.env.COGNITO_DOMAIN}/oauth2/authorize`,
                tokenURL: `https://${process.env.COGNITO_DOMAIN}/oauth2/token`,
                clientID: process.env.COGNITO_CLIENT_ID,
                clientSecret: process.env.COGNITO_CLIENT_SECRET,
                callbackURL: `${process.env.NODE_RED_BASE_URL}/auth/strategy/callback`,
                scope: ['openid', 'email', 'phone'], // Match your Cognito configuration
                
                // Security and compatibility settings
                state: true,
                customHeaders: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            },
            
            // User verification and profile extraction
            verify: function(accessToken, refreshToken, params, profile, done) {
                console.log('Cognito OAuth verification started');
                console.log('Access token received:', accessToken ? 'Yes' : 'No');
                
                // Fetch user info from Cognito userInfo endpoint
                const https = require('https');
                const options = {
                    hostname: process.env.COGNITO_DOMAIN,
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
                            console.log('User info from Cognito:', userInfo);
                            
                            // Map Cognito user to Node-RED user
                            const user = {
                                username: userInfo.email || userInfo['cognito:username'],
                                permissions: mapCognitoToNodeRedPermissions(userInfo),
                                email: userInfo.email,
                                name: userInfo.name || userInfo.given_name + ' ' + userInfo.family_name,
                                // Store additional Cognito info
                                cognitoSub: userInfo.sub,
                                groups: userInfo['cognito:groups'] || []
                            };
                            
                            console.log('Mapped Node-RED user:', {
                                username: user.username,
                                permissions: user.permissions,
                                email: user.email
                            });
                            
                            done(null, user);
                            
                        } catch (error) {
                            console.error('Error parsing Cognito user info:', error);
                            done(error, null);
                        }
                    });
                });
                
                req.on('error', (error) => {
                    console.error('Error fetching Cognito user info:', error);
                    done(error, null);
                });
                
                req.end();
            }
        }
    } : {
        // Fallback to simple credentials for testing without Cognito
        type: "credentials",
        users: [{
            username: "admin",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: "password"
            permissions: "*"
        }, {
            username: "editor",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: "password"
            permissions: ["flows.read", "flows.write", "nodes.read"]
        }, {
            username: "viewer", 
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: "password"
            permissions: "read"
        }]
    },

    // Server settings
    uiPort: process.env.PORT || 1880,
    
    // Enable debug logging for development
    logging: {
        console: {
            level: "debug",
            metrics: true,
            audit: true
        }
    },

    // Enable diagnostics and runtime state for development
    diagnostics: {
        enabled: true,
        ui: true,
    },
    
    runtimeState: {
        enabled: true,
        ui: true,
    },

    // Development-friendly settings
    flowFilePretty: true,
    debugMaxLength: 5000,
    
    // Enable projects for development
    editorTheme: {
        projects: {
            enabled: true,
            workflow: {
                mode: "manual"
            }
        },
        codeEditor: {
            lib: "monaco"
        }
    },

    // Allow external modules for development
    functionExternalModules: true,
    externalModules: {
        palette: {
            allowInstall: true,
            allowUpdate: true,
            allowUpload: true
        }
    }
}