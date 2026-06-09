import { parseJsonBody } from '../_shared/body.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { createUserClient } from '../_shared/supabase.ts';

type TaskInput = {
  title: string;
  description: string;
  assigned_to_email: string;
  status: string;
  due_date: string;
};

type Body = {
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  status?: string;
  event_date?: string;
  budget?: number | null;
  tasks?: TaskInput[];
  participant_emails?: string[];
};

async function resolveUserByEmail(
  supabase: Awaited<ReturnType<typeof createUserClient>> extends { supabase: infer S } ? S : never,
  email: string
) {
  const { data, error } = await supabase.rpc('find_user_by_email', {
    input_email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(error.message);
  const [user] = (data ?? []) as { id: string; email: string }[];
  if (!user) throw new Error(`"${email}" için kullanıcı bulunamadı.`);
  return user;
}

/** POST /functions/v1/create-event */
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
  if (!body?.title?.trim() || !body.description?.trim() || !body.location?.trim()) {
    return errorResponse('title, description and location are required', 400);
  }

  if (!body.event_date) {
    return errorResponse('event_date is required', 400);
  }

  try {
    const { data: event, error: eventError } = await auth.supabase
      .from('events')
      .insert({
        organizer_id: auth.user.id,
        title: body.title.trim(),
        description: body.description.trim(),
        location: body.location.trim(),
        category: body.category ?? 'Konser',
        status: body.status ?? 'Taslak',
        event_date: body.event_date,
        budget: body.budget ?? null,
      })
      .select('id, organizer_id, title, description, location, category, status, event_date, budget')
      .single();

    if (eventError) {
      return errorResponse(eventError.message, 400);
    }

    const tasks = body.tasks ?? [];
    if (tasks.length > 0) {
      const taskRows = await Promise.all(
        tasks.map(async (task) => {
          const assignedUser = await resolveUserByEmail(auth.supabase, task.assigned_to_email);
          return {
            event_id: event.id,
            title: task.title.trim(),
            description: task.description.trim(),
            assigned_to: assignedUser.email,
            assigned_to_user_id: assignedUser.id,
            status: task.status,
            due_date: task.due_date,
          };
        })
      );

      const { error: tasksError } = await auth.supabase.from('tasks').insert(taskRows);
      if (tasksError) {
        return errorResponse(tasksError.message, 400);
      }
    }

    const participantEmails = body.participant_emails ?? [];
    if (participantEmails.length > 0) {
      const participantRows = await Promise.all(
        participantEmails.map(async (email) => {
          const participantUser = await resolveUserByEmail(auth.supabase, email);
          return {
            event_id: event.id,
            email: participantUser.email,
            participant_user_id: participantUser.id,
            invitation_status: 'invited',
            invited_by: auth.user.id,
          };
        })
      );

      const { error: participantsError } = await auth.supabase
        .from('event_participants')
        .insert(participantRows);
      if (participantsError) {
        return errorResponse(participantsError.message, 400);
      }
    }

    return jsonResponse({ data: event }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create event failed';
    return errorResponse(message, 400);
  }
});
