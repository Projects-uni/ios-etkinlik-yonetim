import { Platform } from 'react-native';

/**
 * URL Supabase redirects to after the user clicks the email link.
 * Must match an entry in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 *
 * On web, if EXPO_PUBLIC_RESET_PASSWORD_URL is missing from the build (common on Vercel if env not set),
 * we derive https://<current-host>/reset-password so password reset still works.
 */
export function getResetPasswordRedirectUrl(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_RESET_PASSWORD_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/+$/, '');
    return `${origin}/reset-password`;
  }
  return undefined;
}
