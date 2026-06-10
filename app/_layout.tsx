import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navigationLock = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Fast initial check
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session ?? null);
    });

    // Listen for changes (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') return; // already handled by getSession above
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inTabsGroup = (segments as string[]).includes('(tabs)');
    const onResetPassword = segments[0] === 'reset-password';

    // Sign-out: always redirect to login
    if (!session && inTabsGroup) {
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        navigationLock.current = true;
        router.replace('/');
        setTimeout(() => { navigationLock.current = false; }, 1000);
      }
    } else if (session && !inTabsGroup && !onResetPassword && !navigationLock.current) {
      navigationLock.current = true;
      router.replace('/(tabs)');
      setTimeout(() => { navigationLock.current = false; }, 1000);
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
