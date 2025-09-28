# Deployment Guide for Scheduler App

This guide provides comprehensive instructions for deploying the Scheduler application to production, with a focus on security best practices and reliability.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (managed service recommended)
- Hosting platform (Vercel, Netlify, Railway, or self-hosted)

## Environment Variables

Create a `.env.local` file (for local development) and set the following environment variables in your production environment:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth Configuration
NEXTAUTH_SECRET="your-super-secure-random-string-min-32-chars"
NEXTAUTH_URL="https://yourdomain.com"

# Optional: For production monitoring
SENTRY_DSN="your-sentry-dsn-if-using"
```

### Generating NEXTAUTH_SECRET

Use a cryptographically secure random string:

```bash
# On Linux/Mac
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Database Setup

### Option 1: Managed Database (Recommended)

Use a managed PostgreSQL service:
- **Vercel Postgres** (if deploying on Vercel)
- **Supabase**
- **Neon**
- **Railway**
- **PlanetScale** (with PostgreSQL adapter)

### Option 2: Self-hosted PostgreSQL

Ensure your database has:
- Connection pooling enabled
- SSL/TLS encryption
- Regular backups
- Monitoring for performance

### Database Migration

After setting up the database:

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

## Build and Deployment

### Option 1: Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Vercel will automatically:
   - Install dependencies
   - Run build
   - Deploy to CDN
   - Set up HTTPS

### Option 2: Netlify

1. Connect repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Configure environment variables
5. Enable Netlify Functions for API routes

### Option 3: Railway/DigitalOcean App Platform

1. Connect repository
2. Set build command and start command
3. Configure environment variables
4. Database will be automatically linked if using Railway

### Option 4: Docker Deployment

If using Docker for self-hosting:

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t scheduler .
docker run -p 3000:3000 -e DATABASE_URL=... -e NEXTAUTH_SECRET=... scheduler
```

## Security Configuration

### HTTPS Enforcement

Ensure your hosting platform automatically redirects HTTP to HTTPS and provides SSL certificates.

### Security Headers

The application includes security headers via `src/lib/security.ts`. For additional headers, update `next.config.ts`:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Database Security

- Use connection pooling
- Implement row-level security if needed
- Regular security updates
- Monitor for unusual queries

### Authentication Security

- JWT tokens expire in 30 days (configurable in `src/lib/auth.ts`)
- Passwords are hashed with bcrypt
- Rate limiting is implemented on sensitive endpoints

## Monitoring and Logging

### Error Tracking

Set up error monitoring:

```bash
npm install @sentry/nextjs
```

Configure Sentry in `src/lib/sentry.ts` and initialize in `next.config.ts`.

### Performance Monitoring

- Use Vercel Analytics or similar
- Monitor database query performance
- Set up alerts for high error rates

### Logging

- Log authentication failures
- Monitor rate limiting violations
- Track API usage patterns

## Backup and Recovery

### Database Backups

- Enable automated backups on your database provider
- Test restore procedures regularly
- Keep multiple backup generations

### Application Backups

- Use Git for code versioning
- Consider backing up user-uploaded files if any

## Scaling Considerations

### Database Scaling

- Use read replicas for high-traffic applications
- Implement caching (Redis) for frequently accessed data
- Optimize queries and add indexes as needed

### Application Scaling

- Use CDN for static assets
- Implement horizontal scaling if needed
- Monitor resource usage

## Post-Deployment Checklist

- [ ] HTTPS enabled and working
- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] Authentication working (sign up/sign in)
- [ ] Core features tested (project creation, task scheduling)
- [ ] Security headers applied
- [ ] Monitoring tools configured
- [ ] Backup procedures in place
- [ ] Performance tested under load

## Troubleshooting

### Common Issues

1. **Build fails**: Check Node.js version and dependencies
2. **Database connection fails**: Verify DATABASE_URL format and credentials
3. **Authentication not working**: Check NEXTAUTH_SECRET and NEXTAUTH_URL
4. **CORS issues**: Ensure NEXTAUTH_URL matches your domain

### Support

For issues specific to this application, check:
- Next.js documentation
- NextAuth.js documentation
- Prisma documentation

## Security Best Practices Summary

- Always use HTTPS
- Keep dependencies updated
- Use strong, unique secrets
- Implement proper input validation
- Monitor for security vulnerabilities
- Regular security audits
- Least privilege access

---

This deployment guide ensures your Scheduler application is deployed securely and follows industry best practices. For platform-specific details, refer to your hosting provider's documentation.