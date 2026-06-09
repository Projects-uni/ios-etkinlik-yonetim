import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createServiceClient, createUserClient, isAdmin } from '../_shared/supabase.ts';

type Body = { id?: string };

/** DELETE /functions/v1/delete-event — owner or admin */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'DELETE' && req.method !== 'POST') {
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

  const client = isAdmin(auth.user) ? createServiceClient() : auth.supabase;
  const { error } = await client.from('events').delete().eq('id', body.id);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: { id: body.id } });
});
