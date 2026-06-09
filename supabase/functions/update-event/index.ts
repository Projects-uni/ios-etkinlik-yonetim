import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  id?: string;
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  status?: string;
  event_date?: string;
  budget?: number | null;
};

/** PATCH /functions/v1/update-event */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await createUserClient(req);
  if ('error' in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const body = await parseJsonBody<Body>(req);
  if (!body?.id) {
    return errorResponse('Missing event id', 400);
  }

  const { id, ...fields } = body;
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(payload).length === 0) {
    return errorResponse('No fields to update', 400);
  }

  const { data, error } = await auth.supabase
    .from('events')
    .update(payload)
    .eq('id', id)
    .select('id, organizer_id, title, description, location, category, status, event_date, budget')
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data });
});
