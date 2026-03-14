import { NextRequest, NextResponse } from 'next/server';
import { createTask, getTasks, getTaskById, updateTaskStatus, deleteTask, getTasksByDate, getAllTasksGroupedByDate } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const grouped = searchParams.get('grouped');
    
    if (id) {
      const task = await getTaskById(id);
      return NextResponse.json(task);
    }
    
    if (grouped === 'true') {
      const groupedTasks = await getAllTasksGroupedByDate();
      return NextResponse.json(groupedTasks);
    }
    
    if (date) {
      const tasks = await getTasksByDate(new Date(date));
      return NextResponse.json(tasks);
    }
    
    const tasks = await getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, dueDate, taskDate } = body;
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    const task = await createTask(
      title, 
      undefined, 
      description, 
      dueDate ? new Date(dueDate) : undefined,
      taskDate ? new Date(taskDate) : undefined
    );
    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    if (body.status) {
      const task = await updateTaskStatus(id, body.status);
      return NextResponse.json(task);
    }
    
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
