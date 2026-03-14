import { NextRequest, NextResponse } from 'next/server';
import { createSchedule, getSchedules, getScheduleById, updateSchedule, deleteSchedule } from '@/lib/schedules';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (id) {
      const schedule = await getScheduleById(id);
      return NextResponse.json(schedule);
    }
    
    const schedules = await getSchedules();
    return NextResponse.json(schedules);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, eventTime } = body;
    
    if (!title || !eventTime) {
      return NextResponse.json({ error: 'Title and eventTime are required' }, { status: 400 });
    }
    
    const schedule = await createSchedule(title, new Date(eventTime), undefined, description);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }
    
    const updateData: any = {};
    if (body.title) updateData.title = body.title;
    if (body.description) updateData.description = body.description;
    if (body.eventTime) updateData.eventTime = new Date(body.eventTime);
    
    const schedule = await updateSchedule(id, updateData);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }
    
    await deleteSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
