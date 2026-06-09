import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { requireAdmin } from '../_shared/supabase.ts';

/** GET /functions/v1/admin-stats — admin only */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const now = new Date().toISOString();

  const [
    totalEventsRes,
    completedEventsRes,
    upcomingEventsRes,
    totalUsersRes,
    totalTasksRes,
    completedTasksRes,
  ] = await Promise.all([
    auth.service.from('events').select('id', { count: 'exact', head: true }),
    auth.service.from('events').select('id', { count: 'exact', head: true }).eq('status', 'Tamamlandı'),
    auth.service.from('events').select('id', { count: 'exact', head: true }).gte('event_date', now),
    auth.service.from('profiles').select('id', { count: 'exact', head: true }),
    auth.service.from('tasks').select('id', { count: 'exact', head: true }),
    auth.service.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'Tamamlandı'),
  ]);

  const firstError =
    totalEventsRes.error ||
    completedEventsRes.error ||
    upcomingEventsRes.error ||
    totalUsersRes.error ||
    totalTasksRes.error ||
    completedTasksRes.error;

  if (firstError) {
    return errorResponse(firstError.message, 400);
  }

  return jsonResponse({
    data: {
      totalEvents: totalEventsRes.count ?? 0,
      completedEvents: completedEventsRes.count ?? 0,
      upcomingEvents: upcomingEventsRes.count ?? 0,
      totalUsers: totalUsersRes.count ?? 0,
      totalTasks: totalTasksRes.count ?? 0,
      completedTasks: completedTasksRes.count ?? 0,
    },
  });
});
