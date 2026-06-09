import { invokeFunction } from '@/lib/api/client';

export type UserLookupRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export async function findUserByEmail(email: string): Promise<UserLookupRow | null> {
  return invokeFunction<UserLookupRow | null>('find-user-by-email', {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
  });
}
