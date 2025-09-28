import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overrides = await prisma.userAvailabilityOverride.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(overrides);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error fetching overrides' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, hours } = await request.json();

    const data = {
      userId: session.user.id,
      date: new Date(date),
      hours: hours,
    };

    // Upsert
    const override = await prisma.userAvailabilityOverride.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: new Date(date),
        },
      },
      update: { hours },
      create: data,
    });

    return NextResponse.json(override);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error updating override' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();

    await prisma.userAvailabilityOverride.deleteMany({
      where: {
        userId: session.user.id,
        date: new Date(date),
      },
    });

    return NextResponse.json({ message: 'Override deleted' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error deleting override' }, { status: 500 });
  }
}