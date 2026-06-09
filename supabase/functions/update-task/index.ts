import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  id?: string;
  title?: string;
  description?: string;
  assigned_to_email?: string;
  status?: string;
  due_date?: string;
};

/** PATCH /functions/v1/update-task */
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
    return errorResponse('Missing task id', 400);
  }

  const payload: Record<string, unknown> = {};

  if (body.title !== undefined) payload.title = body.title.trim();
  if (body.description !== undefined) payload.description = body.description.trim();
  if (body.status !== undefined) payload.status = body.status;
  if (body.due_date !== undefined) payload.due_date = body.due_date;

  if (body.assigned_to_email !== undefined) {
    const { data: users, error: lookupError } = await auth.supabase.rpc('find_user_by_email', {
      input_email: body.assigned_to_email.trim().toLowerCase(),
    });
    if (lookupError) return errorResponse(lookupError.message, 400);
    const [assignedUser] = (users ?? []) as { id: string; email: string }[];
    if (!assignedUser) {
      return errorResponse(`"${body.assigned_to_email}" için kullanıcı bulunamadı.`, 404);
    }
    payload.assigned_to = assignedUser.email;
    payload.assigned_to_user_id = assignedUser.id;
  }

  if (Object.keys(payload).length === 0) {
    return errorResponse('No fields to update', 400);
  }

  const { data, error } = await auth.supabase
    .from('tasks')
    .update(payload)
    .eq('id', body.id)
    .select('id, title, description, assigned_to, assigned_to_user_id, due_date, status')
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data });
});
