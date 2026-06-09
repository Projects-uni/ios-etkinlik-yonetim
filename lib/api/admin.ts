import { invokeFunction } from '@/lib/api/client';

export type AdminStats = {
  totalEvents: number;
  completedEvents: number;
  upcomingEvents: number;
  totalUsers: number;
  totalTasks: number;
  completedTasks: number;
};

export type AdminEventRow = {
  id: string;
  title: string;
  status: string;
  event_date: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export async function getAdminStats(): Promise<AdminStats> {
  return invokeFunction<AdminStats>('admin-stats', { method: 'GET' });
}

export async function adminListEvents(): Promise<AdminEventRow[]> {
  return invokeFunction<AdminEventRow[]>('admin-list-events', { method: 'GET' });
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  return invokeFunction<AdminUserRow[]>('admin-list-users', { method: 'GET' });
}
