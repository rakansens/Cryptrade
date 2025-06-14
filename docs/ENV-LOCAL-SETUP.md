# .env.local Setup for Local Development

## ✅ Environment Variables Added

The following Supabase local development credentials have been added to your `.env.local` file:

### Local Supabase Configuration
```env
# API Endpoints
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54331
NEXT_PUBLIC_S3_STORAGE_URL=http://localhost:54331/storage/v1/s3

# Authentication Keys
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Database URLs (for Prisma)
DATABASE_URL="postgresql://postgres:postgres@localhost:54332/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:54332/postgres"

# S3 Storage Keys
S3_ACCESS_KEY=625729a08b95bf1b7ff351a663f3a23c
S3_SECRET_KEY=850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
S3_REGION=local

# JWT Secret
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

## 🔄 Switching Between Local and Production

Your `.env.local` file now contains both production and local configurations:

### For Local Development:
- Use the uncommented local Supabase settings (current setup)
- Supabase runs on custom ports (54331-54339)

### For Production:
- Comment out the local settings
- Uncomment the production Supabase settings

## 📝 Important Notes

1. **Production URLs are preserved** - Your production Supabase configuration is commented out but preserved in the file

2. **Custom Ports** - Local Supabase uses custom ports to avoid conflicts:
   - API: 54331 (instead of 54321)
   - Database: 54332 (instead of 54322)
   - Studio: 54333 (instead of 54323)
   - Email: 54334 (instead of 54324)

3. **Database Password** - Local database uses `postgres` as the password

4. **API Keys** - Your existing OpenAI and other API keys remain unchanged

## 🚀 Quick Commands

```bash
# Verify environment variables are loaded
npm run env:check

# Start local development with Supabase
npm run dev

# Check database connection
npx prisma db pull
```

## 🔒 Security Reminder

- Never commit `.env.local` to version control
- The local keys shown are for development only
- Production keys should be kept secure

Your local development environment is now fully configured!