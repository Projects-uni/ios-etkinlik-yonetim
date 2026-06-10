import { Redirect, Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'admin@gmail.com';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const checkAdmin = useCallback((user: { email?: string; user_metadata?: Record<string, unknown> } | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const emailMatch = user.email?.trim().toLowerCase() === ADMIN_EMAIL;
    const roleMatch =
      typeof user.user_metadata?.role === 'string' &&
      user.user_metadata.role.trim().toLowerCase() === 'admin';
    setIsAdmin(emailMatch || roleMatch);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      checkAdmin(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      checkAdmin(currentSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Hesabım',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Etkinlik Ekle',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
