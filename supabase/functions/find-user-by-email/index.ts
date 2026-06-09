import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = { email?: string };

/** POST /functions/v1/find-user-by-email */
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
  if (!body?.email?.trim()) {
    return errorResponse('Missing email', 400);
  }

  const { data, error } = await auth.supabase.rpc('find_user_by_email', {
    input_email: body.email.trim().toLowerCase(),
  });

  if (error) {
    return errorResponse(error.message, 400);
  }

  const [user] = (data ?? []) as { id: string; email: string; full_name: string | null }[];
  return jsonResponse({ data: user ?? null });
});
