/**
 * Development settings file for Node-RED.
 * Based on the default settings but configured for development.
 */

module.exports = {
    // Use flows in project directory
    flowFile: 'dev-flows.json',
    
    // Enable authentication for testing
    adminAuth: {
        type: "credentials",
        users: [{
            username: "admin",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: "password"
            permissions: "*"
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