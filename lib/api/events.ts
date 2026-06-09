import { invokeFunction } from '@/lib/api/client';

export type EventListItem = {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  event_date: string;
  budget: number | null;
};

export type ParticipantStatusRow = {
  event_id: string;
  invitation_status: string;
};

export type EventTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_to_user_id: string | null;
  due_date: string | null;
  status: string;
};

export type EventParticipant = {
  id: string;
  email: string;
  invitation_status: string;
};

export type EventDetails = {
  tasks: EventTask[];
  participants: EventParticipant[];
  participantCount: number;
};

export type CreateEventPayload = {
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  event_date: string;
  budget: number | null;
  tasks?: {
    title: string;
    description: string;
    assigned_to_email: string;
    status: string;
    due_date: string;
  }[];
  participant_emails?: string[];
};

export type UpdateEventPayload = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  event_date: string;
  budget: number | null;
};

export async function listEvents(): Promise<EventListItem[]> {
  return invokeFunction<EventListItem[]>('list-events', { method: 'GET' });
}

export async function listMyParticipantStatuses(
  eventIds: string[]
): Promise<ParticipantStatusRow[]> {
  if (eventIds.length === 0) {
    return [];
  }
  return invokeFunction<ParticipantStatusRow[]>('list-my-participant-statuses', {
    method: 'POST',
    body: { event_ids: eventIds },
  });
}

export async function getEventDetails(eventId: string): Promise<EventDetails> {
  return invokeFunction<EventDetails>('get-event-details', {
    method: 'POST',
    body: { event_id: eventId },
  });
}

export async function createEvent(payload: CreateEventPayload): Promise<EventListItem> {
  return invokeFunction<EventListItem>('create-event', {
    method: 'POST',
    body: payload,
  });
}

export async function updateEvent(payload: UpdateEventPayload): Promise<EventListItem> {
  return invokeFunction<EventListItem>('update-event', {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteEvent(eventId: string): Promise<{ id: string }> {
  return invokeFunction<{ id: string }>('delete-event', {
    method: 'DELETE',
    body: { id: eventId },
  });
}

export async function respondToInvitation(
  eventId: string,
  response: 'accepted' | 'declined'
): Promise<{ response: string }> {
  return invokeFunction<{ response: string }>('respond-to-invitation', {
    method: 'POST',
    body: { event_id: eventId, response },
  });
}
