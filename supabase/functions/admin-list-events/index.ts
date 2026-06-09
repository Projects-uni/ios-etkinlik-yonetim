import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { requireAdmin } from '../_shared/supabase.ts';

/** GET /functions/v1/admin-list-events — admin only */
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

  const { data, error } = await auth.service
    .from('events')
    .select('id, title, status, event_date')
    .order('event_date', { ascending: true });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: data ?? [] });
});
