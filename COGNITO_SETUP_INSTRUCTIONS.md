# AWS Cognito Setup Instructions for Node-RED

## Quick Setup for Testing

To test the Cognito integration, follow these steps:

### 1. Configure Environment Variables

Edit the `.env` file with your actual Cognito settings:

```bash
# Your Cognito User Pool Domain (without https://)
COGNITO_DOMAIN=your-app-name.auth.us-east-1.amazoncognito.com

# Your Cognito App Client credentials
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_CLIENT_SECRET=your-secret-key

# AWS Region where your User Pool is located
COGNITO_REGION=us-east-1

# Your User Pool ID
COGNITO_POOL_ID=us-east-1_ABC123DEF

# Node-RED base URL
NODE_RED_BASE_URL=http://localhost:1880
```

### 2. AWS Cognito Configuration Required

#### Create User Pool (if not exists)
```bash
aws cognito-idp create-user-pool \
    --pool-name "NodeRedUsers" \
    --policies "PasswordPolicy={MinimumLength=8}" \
    --auto-verified-attributes email \
    --username-attributes email
```

#### Create App Client
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

#### Setup Hosted UI Domain
```bash
aws cognito-idp create-user-pool-domain \
    --user-pool-id us-east-1_YourPoolId \
    --domain your-unique-domain-name
```

#### Create User Groups (Optional but Recommended)
```bash
# Admin group - gets full permissions (*)
aws cognito-idp create-group \
    --group-name "node-red-admins" \
    --user-pool-id us-east-1_YourPoolId \
    --description "Node-RED Administrators"

# Editor group - gets flows.read, flows.write, nodes.read
aws cognito-idp create-group \
    --group-name "node-red-editors" \
    --user-pool-id us-east-1_YourPoolId \
    --description "Node-RED Editors"
```

### 3. Test the Integration

1. Update your `.env` file with real Cognito values
2. Start Node-RED: `npm run dev`
3. Navigate to `http://localhost:1880`
4. Click "Sign in with AWS Cognito"
5. Complete the authentication flow
6. Check the console logs for debugging info

### 4. Create Test Users

Create users in your Cognito User Pool and assign them to groups:

```bash
# Create a test admin user
aws cognito-idp admin-create-user \
    --user-pool-id us-east-1_YourPoolId \
    --username admin@yourcompany.com \
    --user-attributes Name=email,Value=admin@yourcompany.com \
    --temporary-password TempPass123! \
    --message-action SUPPRESS

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
    --user-pool-id us-east-1_YourPoolId \
    --username admin@yourcompany.com \
    --group-name node-red-admins
```

## Permission Mapping

The current configuration maps users as follows:

- **`node-red-admins` group** → `"*"` (full access)
- **`node-red-editors` group** → `["flows.read", "flows.write", "nodes.read"]`
- **Email ending with `@yourcompany.com`** → `"*"` (full access)
- **Any other authenticated user** → `"read"` (read-only)

## Troubleshooting

### Common Issues:

1. **"Invalid redirect URI"**
   - Ensure callback URL in Cognito exactly matches: `http://localhost:1880/auth/strategy/callback`
   - Check for trailing slashes or protocol mismatches

2. **"Client authentication failed"**
   - Verify COGNITO_CLIENT_ID and COGNITO_CLIENT_SECRET in .env
   - Ensure App Client has "Generate client secret" enabled

3. **"User info fetch failed"**
   - Check that your App Client allows the `openid`, `email`, and `profile` scopes
   - Verify the Cognito domain is correct

4. **Authentication succeeds but permissions are wrong**
   - Check console logs for user info and permission mapping
   - Verify user group membership in Cognito console

### Debug Mode

The configuration includes detailed logging. Check the Node-RED console for:
- OAuth verification start/completion
- User info from Cognito
- Permission mapping results
- Any error messages

## Security Notes

- Never commit the `.env` file to version control
- Use HTTPS in production
- Consider implementing token refresh for long-running sessions
- Regularly rotate client secrets
- Monitor authentication audit logs