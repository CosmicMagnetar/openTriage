# Backend Environment Configuration

Create a `.env.local` file in the `backend-ts` directory with the following variables:

```bash
# Database Configuration
TURSO_DATABASE_URL=your_database_url_here
TURSO_AUTH_TOKEN=your_auth_token_here
DATABASE_URL=your_database_url_here

# JWT Secret (generate a random secure string)
JWT_SECRET=your_secure_random_secret_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

## How to Generate JWT_SECRET

Run this command to generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing the Backend

1. Start the backend server:

```bash
cd backend-ts
npm run dev
```

2. Test the health endpoint:

```bash
curl http://localhost:3001/api/health
```

3. Expected response:

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-28T...",
  "env": {
    "jwt_secret_set": true,
    "database_url_set": true
  }
}
```

## Common Issues

### 500 Internal Server Error

- **Cause**: Missing environment variables (JWT_SECRET, DATABASE_URL, etc.)
- **Solution**: Ensure all required environment variables are set in `.env.local`

### Database Connection Failed

- **Cause**: Invalid Turso credentials or database not accessible
- **Solution**: Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are correct

### ERR_NETWORK_IO_SUSPENDED

- **Cause**: Too many failed polling requests or network issues
- **Solution**: The frontend now has retry logic that stops after 3 consecutive failures
