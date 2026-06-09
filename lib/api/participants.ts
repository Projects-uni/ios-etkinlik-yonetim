import { invokeFunction } from '@/lib/api/client';

import type { EventParticipant } from '@/lib/api/events';

export type CreateParticipantPayload = {
  event_id: string;
  email: string;
  invitation_status?: string;
};

export type UpdateParticipantPayload = {
  id: string;
  email?: string;
  invitation_status?: string;
};

export async function createParticipant(
  payload: CreateParticipantPayload
): Promise<EventParticipant> {
  return invokeFunction<EventParticipant>('create-participant', {
    method: 'POST',
    body: payload,
  });
}

export async function updateParticipant(
  payload: UpdateParticipantPayload
): Promise<EventParticipant> {
  return invokeFunction<EventParticipant>('update-participant', {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteParticipant(participantId: string): Promise<{ id: string }> {
  return invokeFunction<{ id: string }>('delete-participant', {
    method: 'DELETE',
    body: { id: participantId },
  });
}
