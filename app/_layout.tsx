import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    // Fast initial check
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session ?? null);
    });

    // Listen for changes (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[Auth] Auth state changed:', event, 'session is now:', nextSession ? 'ACTIVE' : 'NULL');
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log('[Router] Routing check. Session is:', session ? 'ACTIVE' : (session === null ? 'NULL' : 'UNDEFINED'), 'Segments:', segments);
    
    if (session === undefined) return;

    const inTabsGroup = (segments as string[]).includes('(tabs)');
    const onResetPassword = segments[0] === 'reset-password';

    if (!session && inTabsGroup) {
      console.log('[Router] User is logged out but in tabs. Attempting redirect to /login ... Platform:', Platform.OS);
      // User signed out but still in a protected group
      if (Platform.OS === 'web') {
        window.location.href = '/login';
      } else {
        console.log('[Router] Clearing navigation stack on iOS');
        try {
          // This clears the navigation history to safely return to root
          if (router.canDismiss()) {
            router.dismissAll();
          }
          router.replace('/login');
          console.log('[Router] router.replace("/login") finished executing');
        } catch (err) {
          console.error('[Router] Error during navigation:', err);
        }
      }
    } else if (session && !inTabsGroup && !onResetPassword) {
      console.log('[Router] User is logged in but outside tabs. Attempting redirect to /(tabs) ...');
      // User signed in but outside the protected group
      router.replace('/(tabs)');
    }
  }, [router, session, segments]);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
