import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  event_id?: string;
  email?: string;
  invitation_status?: string;
};

/** POST /functions/v1/create-participant */
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
  if (!body?.event_id || !body.email?.trim()) {
    return errorResponse('Missing event_id or email', 400);
  }

  const { data: users, error: lookupError } = await auth.supabase.rpc('find_user_by_email', {
    input_email: body.email.trim().toLowerCase(),
  });

  if (lookupError) {
    return errorResponse(lookupError.message, 400);
  }

  const [participantUser] = (users ?? []) as { id: string; email: string }[];
  if (!participantUser) {
    return errorResponse(`"${body.email}" için kullanıcı bulunamadı.`, 404);
  }

  const { data, error } = await auth.supabase
    .from('event_participants')
    .insert({
      event_id: body.event_id,
      email: participantUser.email,
      participant_user_id: participantUser.id,
      invitation_status: body.invitation_status ?? 'invited',
      invited_by: auth.user.id,
    })
    .select('id, email, invitation_status')
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data }, 201);
});
