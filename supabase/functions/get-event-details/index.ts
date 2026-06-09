import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = { event_id?: string };

/** POST /functions/v1/get-event-details */
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
  if (!body?.event_id) {
    return errorResponse('Missing event_id', 400);
  }

  const { data: event, error: eventError } = await auth.supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', body.event_id)
    .maybeSingle();

  if (eventError) {
    return errorResponse(eventError.message, 400);
  }

  if (!event) {
    return errorResponse('Event not found', 404);
  }

  const isOwner = event.organizer_id === auth.user.id;

  const [tasksResult, countResult, participantsResult] = await Promise.all([
    auth.supabase
      .from('tasks')
      .select('id, title, description, assigned_to, assigned_to_user_id, due_date, status')
      .eq('event_id', body.event_id)
      .order('due_date', { ascending: true }),
    auth.supabase.rpc('get_event_participant_count', { input_event_id: body.event_id }),
    isOwner
      ? auth.supabase
          .from('event_participants')
          .select('id, email, invitation_status')
          .eq('event_id', body.event_id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksResult.error) return errorResponse(tasksResult.error.message, 400);
  if (countResult.error) return errorResponse(countResult.error.message, 400);
  if (participantsResult.error) return errorResponse(participantsResult.error.message, 400);

  return jsonResponse({
    data: {
      tasks: tasksResult.data ?? [],
      participants: participantsResult.data ?? [],
      participantCount: countResult.data ?? 0,
    },
  });
});
