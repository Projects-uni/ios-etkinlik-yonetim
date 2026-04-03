import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 👇 This effect handles all navigation based on auth state
  useEffect(() => {
    if (session === undefined) return; // still loading

    const inTabsGroup = segments[0] === '(tabs)';
    const onResetPassword = segments[0] === 'reset-password';

    if (!session && inTabsGroup) {
      router.replace('/');
    } else if (session && !inTabsGroup && !onResetPassword) {
      router.replace('/(tabs)');
    }
  }, [router, segments, session]);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
