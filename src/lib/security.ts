// Security utilities and configurations
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Rate limiting using a more robust approach with cleanup
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime + 60000) { // Keep entries for 1 minute after reset
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function checkRateLimit(
  req: NextRequest,
  maxRequests = 10,
  windowMs = 15 * 60 * 1000,
  identifier?: string
): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             req.headers.get('cf-connecting-ip') || // Cloudflare
             'unknown';

  // Use provided identifier or IP
  const key = identifier || ip;
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;

  const current = rateLimitMap.get(windowKey) || {
    count: 0,
    resetTime: now + windowMs,
    lastAccess: now
  };

  // Reset if window has passed
  if (now > current.resetTime) {
    current.count = 1;
    current.resetTime = now + windowMs;
    current.lastAccess = now;
  } else if (current.count >= maxRequests) {
    return false;
  } else {
    current.count++;
    current.lastAccess = now;
  }

  rateLimitMap.set(windowKey, current);
  return true;
}

// Get rate limit info for headers
export function getRateLimitInfo(req: NextRequest, maxRequests = 10, windowMs = 15 * 60 * 1000): {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
} {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             req.headers.get('cf-connecting-ip') ||
             'unknown';

  const now = Date.now();
  const windowKey = `${ip}:${Math.floor(now / windowMs)}`;
  const current = rateLimitMap.get(windowKey);

  if (!current || now > current.resetTime) {
    return { remaining: maxRequests - 1, resetTime: now + windowMs, isLimited: false };
  }

  const remaining = Math.max(0, maxRequests - current.count);
  return {
    remaining: remaining - 1, // Subtract 1 for current request
    resetTime: current.resetTime,
    isLimited: current.count >= maxRequests
  };
}

// Enhanced security headers
export function addSecurityHeaders(response: NextResponse, options: {
  includeCSP?: boolean;
  includeHSTS?: boolean;
} = {}) {
  const { includeCSP = false, includeHSTS = false } = options;

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  if (includeCSP) {
    response.headers.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none';"
    );
  }

  if (includeHSTS) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

// Create secure response with rate limit headers
export function createSecureResponse(
  data: unknown,
  status = 200,
  options: { includeCSP?: boolean; includeHSTS?: boolean } = {}
) {
  const response = NextResponse.json(data, { status });
  return addSecurityHeaders(response, options);
}

// Create error response
export function createErrorResponse(
  message: string,
  status = 500,
  options: { includeCSP?: boolean; includeHSTS?: boolean } = {}
) {
  const response = NextResponse.json({ error: message }, { status });
  return addSecurityHeaders(response, options);
}

// Enhanced input sanitization
export function sanitizeInput(input: string, options: {
  allowHtml?: boolean;
  maxLength?: number;
} = {}): string {
  const { allowHtml = false, maxLength } = options;

  let sanitized = input.trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  if (!allowHtml) {
    // Remove HTML tags and encode special characters
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/[<>]/g, '');
  }

  return sanitized;
}

// Enhanced email validation
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

// Enhanced password validation with configurable requirements
export function isValidPassword(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): boolean {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options;

  if (password.length < minLength) return false;

  if (requireUppercase && !/[A-Z]/.test(password)) return false;
  if (requireLowercase && !/[a-z]/.test(password)) return false;
  if (requireNumbers && !/\d/.test(password)) return false;
  if (requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;

  return true;
}

// Password strength checker
export function getPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Use at least 8 characters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Include uppercase letters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Include lowercase letters');

  if (/\d/.test(password)) score++;
  else feedback.push('Include numbers');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  else feedback.push('Include special characters');

  if (password.length >= 12) score++;
  if (/(.)\1{2,}/.test(password)) score--; // Penalize repeated characters

  return { score: Math.max(0, Math.min(5, score)), feedback };
}

// CSRF protection helper (basic implementation)
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Validate CSRF token
export function validateCSRFToken(token: string): boolean {
  // In a real implementation, you'd store tokens in session/database
  // This is a basic example
  return token.length === 64 && /^[a-f0-9]+$/.test(token);
}