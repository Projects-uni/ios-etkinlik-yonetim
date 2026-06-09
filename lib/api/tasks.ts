import { invokeFunction } from '@/lib/api/client';

import type { EventTask } from '@/lib/api/events';

export type CreateTaskPayload = {
  event_id: string;
  title: string;
  description: string;
  assigned_to_email: string;
  status: string;
  due_date: string;
};

export type UpdateTaskPayload = {
  id: string;
  title?: string;
  description?: string;
  assigned_to_email?: string;
  status?: string;
  due_date?: string;
};

export async function createTask(payload: CreateTaskPayload): Promise<EventTask> {
  return invokeFunction<EventTask>('create-task', { method: 'POST', body: payload });
}

export async function updateTask(payload: UpdateTaskPayload): Promise<EventTask> {
  return invokeFunction<EventTask>('update-task', { method: 'PATCH', body: payload });
}

export async function deleteTask(taskId: string): Promise<{ id: string }> {
  return invokeFunction<{ id: string }>('delete-task', {
    method: 'DELETE',
    body: { id: taskId },
  });
}
