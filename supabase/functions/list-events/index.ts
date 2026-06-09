import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

/**
 * GET /functions/v1/list-events
 * Returns events visible to the authenticated user (RLS applies).
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await createUserClient(req);
  if ('error' in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from('events')
    .select('id, organizer_id, title, description, location, category, status, event_date, budget')
    .order('event_date', { ascending: true });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: data ?? [] });
});
