import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSecureResponse, createErrorResponse } from '@/lib/security';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401);
    }

    const availability = await prisma.userAvailability.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    return createSecureResponse(availability);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return createErrorResponse('Error fetching availability');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { availability } = await request.json(); // array of { dayOfWeek, hours }

    // Delete existing
    await prisma.userAvailability.deleteMany({
      where: { userId: session.user.id },
    });

    // Create new
    const data = availability.map((a: { dayOfWeek: number; hours: number }) => ({
      userId: session.user.id,
      dayOfWeek: a.dayOfWeek,
      hours: a.hours,
    }));

    await prisma.userAvailability.createMany({
      data,
    });

    return createSecureResponse({ message: 'Availability updated' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return createErrorResponse('Error updating availability');
  }
}