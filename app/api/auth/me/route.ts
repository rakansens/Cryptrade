import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/auth-handler';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    // Get user data from database
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user,
      session: {
        expiresAt: req.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
});