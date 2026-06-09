import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  event_id?: string;
  title?: string;
  description?: string;
  assigned_to_email?: string;
  status?: string;
  due_date?: string;
};

/** POST /functions/v1/create-task */
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
  if (!body?.event_id || !body.title?.trim() || !body.description?.trim() || !body.assigned_to_email?.trim()) {
    return errorResponse('Missing required task fields', 400);
  }

  if (!body.due_date) {
    return errorResponse('due_date is required', 400);
  }

  const { data: users, error: lookupError } = await auth.supabase.rpc('find_user_by_email', {
    input_email: body.assigned_to_email.trim().toLowerCase(),
  });

  if (lookupError) {
    return errorResponse(lookupError.message, 400);
  }

  const [assignedUser] = (users ?? []) as { id: string; email: string }[];
  if (!assignedUser) {
    return errorResponse(`"${body.assigned_to_email}" için kullanıcı bulunamadı.`, 404);
  }

  const { data, error } = await auth.supabase
    .from('tasks')
    .insert({
      event_id: body.event_id,
      title: body.title.trim(),
      description: body.description.trim(),
      assigned_to: assignedUser.email,
      assigned_to_user_id: assignedUser.id,
      status: body.status ?? 'Beklemede',
      due_date: body.due_date,
    })
    .select('id, title, description, assigned_to, assigned_to_user_id, due_date, status')
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data }, 201);
});
