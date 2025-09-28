import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { checkRateLimit, addSecurityHeaders, sanitizeInput, isValidEmail, isValidPassword } from '@/lib/security';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    if (!checkRateLimit(request, 5, 15 * 60 * 1000)) { // 5 requests per 15 minutes
      return addSecurityHeaders(NextResponse.json({ error: 'Too many requests' }, { status: 429 }));
    }

    const { email, password } = await request.json();

    // Input validation and sanitization
    if (!email || !password) {
      return addSecurityHeaders(NextResponse.json({ error: 'Email and password are required' }, { status: 400 }));
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedPassword = password; // Don't sanitize password as it might contain special chars

    if (!isValidEmail(sanitizedEmail)) {
      return addSecurityHeaders(NextResponse.json({ error: 'Invalid email format' }, { status: 400 }));
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
      return addSecurityHeaders(NextResponse.json({ error: 'User already exists' }, { status: 400 }));
    }

    // Hash password with higher rounds for security
    const hashedPassword = await bcrypt.hash(sanitizedPassword, 12);

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
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return addSecurityHeaders(response);
  }
}