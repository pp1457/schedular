import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  checkRateLimit,
  getRateLimitInfo,
  addSecurityHeaders,
  sanitizeInput,
  isValidEmail,
  isValidPassword
} from '@/lib/security';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Enhanced rate limiting for signup
    const rateLimitInfo = getRateLimitInfo(request, 5, 15 * 60 * 1000); // 5 per 15 minutes
    if (rateLimitInfo.isLimited) {
      const response = NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
      response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      response.headers.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toString());
      return addSecurityHeaders(response);
    }

    if (!checkRateLimit(request, 5, 15 * 60 * 1000)) {
      const response = NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('Retry-After', '900'); // 15 minutes
      return addSecurityHeaders(response);
    }

    const { email, password } = await request.json();

    // Enhanced input validation and sanitization
    if (!email || !password) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      ));
    }

    const sanitizedEmail = sanitizeInput(email, { maxLength: 254 }).toLowerCase();
    const sanitizedPassword = password; // Don't sanitize password as it might contain special chars

    if (!isValidEmail(sanitizedEmail)) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      ));
    }

    if (!isValidPassword(sanitizedPassword)) {
      return addSecurityHeaders(NextResponse.json({
        error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character (@$!%*?&-_)' 
      }, { status: 400 }));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      ));
    }

    // Hash password with higher rounds for security (configurable)
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(sanitizedPassword, saltRounds);

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password_hash: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        created_at: true,
      },
    });

    const response = NextResponse.json({
      message: 'User created successfully',
      user: user
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Signup error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}