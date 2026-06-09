import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  adminListEvents,
  adminListUsers,
  getAdminStats,
  type AdminEventRow,
  type AdminStats,
  type AdminUserRow,
} from '@/lib/api/admin';
import { deleteEvent as deleteEventApi } from '@/lib/api/events';
import { supabase } from '@/lib/supabase';

export default function AdminScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRole = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed to load user for role', error);
      setRole(null);
      return;
    }
    const user = data.user;
    const metaRole =
      user && typeof user.user_metadata?.role === 'string'
        ? user.user_metadata.role.trim().toLowerCase()
        : null;
    setRole(metaRole);
  }, []);

  const loadStatsAndLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, eventsData, usersData] = await Promise.all([
        getAdminStats(),
        adminListEvents(),
        adminListUsers(),
      ]);

      setStats(statsData);
      setEvents(eventsData);
      setUsers(usersData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'İstatistikler yüklenemedi.';
      Alert.alert('Yükleme hatası', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRole();
      void loadStatsAndLists();
    }, [loadRole, loadStatsAndLists])
  );

  const handleDeleteEvent = async (event: AdminEventRow) => {
    Alert.alert(
      'Etkinlik silinsin mi?',
      `"${event.title}" etkinliğini tüm görev ve katılımcılarıyla birlikte silmek üzeresiniz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventApi(event.id);
              setEvents((current) => current.filter((item) => item.id !== event.id));
              setIsRefreshing(true);
              void loadStatsAndLists();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Etkinlik silinemedi.';
              Alert.alert('Silme hatası', message);
            }
          },
        },
      ]
    );
  };

  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color="#64748B" />
          <Text style={styles.lockTitle}>Yalnızca yöneticiler</Text>
          <Text style={styles.lockText}>
            Bu sayfaya erişmek için hesabınızın rolü `admin` olmalıdır.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadStatsAndLists();
            }}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Yönetim Paneli</Text>
            <Text style={styles.headerSubtitle}>Sistem durumu ve istatistikler</Text>
          </View>
          {isLoading ? <ActivityIndicator size="small" color="#2563EB" /> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.statLabel}>Toplam Etkinlik</Text>
            <Text style={styles.statValue}>{stats?.totalEvents ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={styles.statLabel}>Tamamlanan Etkinlik</Text>
            <Text style={styles.statValue}>{stats?.completedEvents ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.statLabel}>Yaklaşan Etkinlik</Text>
            <Text style={styles.statValue}>{stats?.upcomingEvents ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E2E8F0' }]}>
            <Text style={styles.statLabel}>Kullanıcı Sayısı</Text>
            <Text style={styles.statValue}>{stats?.totalUsers ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#C7D2FE' }]}>
            <Text style={styles.statLabel}>Toplam Görev</Text>
            <Text style={styles.statValue}>{stats?.totalTasks ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#BFDBFE' }]}>
            <Text style={styles.statLabel}>Tamamlanan Görev</Text>
            <Text style={styles.statValue}>{stats?.completedTasks ?? 0}</Text>
          </View>
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tüm Etkinlikler</Text>
            <Text style={styles.sectionCaption}>{events.length} kayıt</Text>
          </View>
          {events.map((event) => (
            <View key={event.id} style={styles.listCard}>
              <View style={styles.listCardMain}>
                <Text style={styles.listTitle}>{event.title}</Text>
                <Text style={styles.listMeta}>
                  Durum: <Text style={styles.listMetaStrong}>{event.status}</Text>
                </Text>
                <Text style={styles.listMeta}>Tarih: {new Date(event.event_date).toLocaleString('tr-TR')}</Text>
              </View>
              <View style={styles.listActions}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="#B91C1C"
                  onPress={() => handleDeleteEvent(event)}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kullanıcılar</Text>
            <Text style={styles.sectionCaption}>{users.length} kayıt</Text>
          </View>
          {users.map((user) => (
            <View key={user.id} style={styles.listCard}>
              <View style={styles.listCardMain}>
                <Text style={styles.listTitle}>{user.full_name || 'İsimsiz Kullanıcı'}</Text>
                <Text style={styles.listMeta}>{user.email}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    paddingVertical: 8,
    gap: 12,
  },
  statCard: {
    width: 160,
    borderRadius: 18,
    padding: 14,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2933',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sectionCaption: {
    fontSize: 13,
    color: '#6B7280',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listCardMain: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  listMetaStrong: {
    fontWeight: '700',
    color: '#111827',
  },
  listActions: {
    paddingLeft: 8,
  },
});
