import { supabase } from '@/lib/supabase';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ggrtavmlclgxmhzjuozn.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

export function getFunctionsBaseUrl(): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
}

type InvokeOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

type ApiSuccess<T> = {
  data: T;
};

type ApiError = {
  error: string;
};

/**
 * Calls a Supabase Edge Function with the current user's JWT.
 */
export async function invokeFunction<T>(functionName: string, options: InvokeOptions = {}): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }

  const { method = 'GET', body } = options;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };

  if (supabaseAnonKey) {
    headers.apikey = supabaseAnonKey;
  }

  const response = await fetch(`${getFunctionsBaseUrl()}/${functionName}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiSuccess<T> | ApiError;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiError;
  } catch {
    throw new Error(`API yanıtı okunamadı (${response.status})`);
  }

  if (!response.ok) {
    const message = 'error' in payload ? payload.error : `İstek başarısız (${response.status})`;
    throw new Error(message);
  }

  if (!('data' in payload)) {
    throw new Error('API yanıtında data alanı yok');
  }

  return payload.data;
}
