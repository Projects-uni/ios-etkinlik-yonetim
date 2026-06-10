import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2';

export async function createUserClient(req: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
} | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Server configuration error', status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { supabase, user };
}

export function isAdmin(user: User): boolean {
  const email = (user.email ?? '').trim().toLowerCase();
  if (email === 'admin@gmail.com') return true;

  const role =
    typeof user.user_metadata?.role === 'string'
      ? user.user_metadata.role.trim().toLowerCase()
      : '';
  return role === 'admin';
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server configuration error');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function requireAdmin(req: Request): Promise<
  | { supabase: SupabaseClient; user: User; service: SupabaseClient }
  | { error: string; status: number }
> {
  const auth = await createUserClient(req);
  if ('error' in auth) {
    return auth;
  }

  if (!isAdmin(auth.user)) {
    return { error: 'Forbidden — admin only', status: 403 };
  }

  return { ...auth, service: createServiceClient() };
}
