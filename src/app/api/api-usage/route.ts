import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiUsage } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const usage = await db
      .select()
      .from(apiUsage)
      .orderBy(desc(apiUsage.createdAt))
      .limit(100);
    return NextResponse.json(usage);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch API usage' }, { status: 500 });
  }
}
