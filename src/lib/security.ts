// Security utilities and configurations
import { NextRequest, NextResponse } from 'next/server';

// Rate limiting (basic implementation - consider using a proper rate limiter in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(req: NextRequest, maxRequests = 10, windowMs = 15 * 60 * 1000): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             'unknown';
  const now = Date.now();
  const windowKey = `${ip}:${Math.floor(now / windowMs)}`;

  const current = rateLimitMap.get(windowKey) || { count: 0, resetTime: now + windowMs };

  if (now > current.resetTime) {
    current.count = 1;
    current.resetTime = now + windowMs;
  } else if (current.count >= maxRequests) {
    return false;
  } else {
    current.count++;
  }

  rateLimitMap.set(windowKey, current);
  return true;
}

// Security headers
export function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

// Create secure response
export function createSecureResponse(data: any, status = 200) {
  const response = NextResponse.json(data, { status });
  return addSecurityHeaders(response);
}

// Create error response
export function createErrorResponse(message: string, status = 500) {
  const response = NextResponse.json({ error: message }, { status });
  return addSecurityHeaders(response);
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Validate password strength
export function isValidPassword(password: string): boolean {
  // At least 8 characters, contains uppercase, lowercase, number, and special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_])[A-Za-z\d@$!%*?&\-_]{8,}$/;
  return passwordRegex.test(password);
}