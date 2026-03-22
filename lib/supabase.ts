import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ggrtavmlclgxmhzjuozn.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncnRhdm1sY2xneG1oemp1b3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDcxMDksImV4cCI6MjA4OTc4MzEwOX0.S5hRIa_-Mo9nQ97EnbwMfqmZv0ytyb-EiURMSrclpd8';

const storage =
  Platform.OS === 'web'
    ? undefined   // web: supabase will use localStorage automatically
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(storage ? { storage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
