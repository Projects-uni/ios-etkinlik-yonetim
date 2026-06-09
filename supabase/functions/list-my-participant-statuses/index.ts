import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type RequestBody = {
  event_ids?: string[];
};

/**
 * POST /functions/v1/list-my-participant-statuses
 * Body: { "event_ids": ["uuid", ...] }
 * Returns invitation status per event for the current user.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await createUserClient(req);
  if ('error' in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { supabase, user } = auth;

  let body: RequestBody = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as RequestBody;
    }
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const eventIds = Array.isArray(body.event_ids) ? body.event_ids.filter(Boolean) : [];

  if (eventIds.length === 0) {
    return jsonResponse({ data: [] });
  }

  const { data, error } = await supabase
    .from('event_participants')
    .select('event_id, invitation_status')
    .eq('participant_user_id', user.id)
    .in('event_id', eventIds);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: data ?? [] });
});
