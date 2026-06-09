import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  id?: string;
  email?: string;
  invitation_status?: string;
};

/** PATCH /functions/v1/update-participant */
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
    return errorResponse('Missing participant id', 400);
  }

  const payload: Record<string, unknown> = {};

  if (body.invitation_status !== undefined) {
    payload.invitation_status = body.invitation_status;
  }

  if (body.email !== undefined) {
    const { data: users, error: lookupError } = await auth.supabase.rpc('find_user_by_email', {
      input_email: body.email.trim().toLowerCase(),
    });
    if (lookupError) return errorResponse(lookupError.message, 400);
    const [participantUser] = (users ?? []) as { id: string; email: string }[];
    if (!participantUser) {
      return errorResponse(`"${body.email}" için kullanıcı bulunamadı.`, 404);
    }
    payload.email = participantUser.email;
    payload.participant_user_id = participantUser.id;
  }

  if (Object.keys(payload).length === 0) {
    return errorResponse('No fields to update', 400);
  }

  const { data, error } = await auth.supabase
    .from('event_participants')
    .update(payload)
    .eq('id', body.id)
    .select('id, email, invitation_status')
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data });
});
