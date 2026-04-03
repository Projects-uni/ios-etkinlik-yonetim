import type { Session } from '@supabase/supabase-js';

/**
 * Recovery links establish a short-lived session so updateUser({ password }) works.
 * That session must not be shown as "logged in" on the home screen — we route to /reset-password instead.
 */
export function isPasswordRecoverySession(session: Session | null): boolean {
  if (!session?.access_token) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1])) as {
      amr?: Array<{ method?: string } | string>;
      type?: string;
    };
    if (payload.type === 'recovery') {
      return true;
    }
    const amr = payload.amr;
    if (!Array.isArray(amr)) {
      return false;
    }
    for (const entry of amr) {
      if (entry === 'recovery') {
        return true;
      }
      if (typeof entry === 'object' && entry?.method === 'recovery') {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
