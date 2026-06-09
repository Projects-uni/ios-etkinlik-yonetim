import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  event_id?: string;
  response?: string;
};

/** POST /functions/v1/respond-to-invitation */
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

  const body = await parseJsonBody<Body>(req);
  if (!body?.event_id || !body.response) {
    return errorResponse('Missing event_id or response', 400);
  }

  const normalized = body.response.trim().toLowerCase();
  if (normalized !== 'accepted' && normalized !== 'declined') {
    return errorResponse('response must be accepted or declined', 400);
  }

  const { data, error } = await auth.supabase.rpc('respond_to_invitation', {
    input_event_id: body.event_id,
    input_response: normalized,
  });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: { response: data } });
});
