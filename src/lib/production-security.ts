// Production Security Configuration
// This file contains security recommendations for production deployment

/*
SECURITY CHECKLIST FOR PRODUCTION:

1. Environment Variables:
   - NEXTAUTH_SECRET: Generate a strong random string (min 32 characters)
   - NEXTAUTH_URL: Set to your production domain with https://
   - DATABASE_URL: Use connection pooling and secure credentials

2. HTTPS Enforcement:
   - Ensure your hosting platform (Vercel, etc.) enforces HTTPS
   - Add security headers in next.config.js:
   module.exports = {
     async headers() {
       return [
         {
           source: '/(.*)',
           headers: [
             { key: 'X-Frame-Options', value: 'DENY' },
             { key: 'X-Content-Type-Options', value: 'nosniff' },
             { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
             { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
           ],
         },
       ];
     },
   };

3. Database Security:
   - Use connection pooling (e.g., PgBouncer for PostgreSQL)
   - Implement row-level security in database if needed
   - Regular database backups
   - Monitor for unusual queries

4. Monitoring & Logging:
   - Implement error tracking (Sentry, etc.)
   - Log authentication failures
   - Monitor rate limiting violations
   - Set up alerts for security events

5. Additional Security Measures:
   - Implement CSRF protection if needed (NextAuth handles this)
   - Consider adding CAPTCHA for signup
   - Implement account lockout after failed attempts
   - Add email verification for new accounts

6. Session Security:
   - Session maxAge is set to 30 days
   - JWT strategy provides good security
   - Consider shorter session times for sensitive applications

7. API Security:
   - All routes now check authentication
   - Input validation and sanitization implemented
   - Rate limiting on sensitive endpoints
   - Proper error handling without information leakage

8. Frontend Security:
   - Use HTTPS for all requests
   - Implement proper error handling
   - Avoid storing sensitive data in localStorage
   - Use secure cookie settings
*/

export const PRODUCTION_SECURITY_CONFIG = {
  // These are recommendations - implement in your deployment
  recommendedHeaders: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },

  // Rate limiting recommendations
  rateLimits: {
    signup: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
    login: { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
    api: { maxRequests: 100, windowMs: 15 * 60 * 1000 }, // 100 per 15 minutes
  },

  // Password policy
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
};