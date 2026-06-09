import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = { id?: string };

/** DELETE /functions/v1/delete-task */
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
    return errorResponse('Missing task id', 400);
  }

  const { error } = await auth.supabase.from('tasks').delete().eq('id', body.id);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data: { id: body.id } });
});
