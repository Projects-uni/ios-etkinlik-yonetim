import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'users'>('overview');

  const loadRole = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed to load user for role', error);
      setRole(null);
      return;
    }
    const user = data.user;
    const isAdminEmail = user?.email?.trim().toLowerCase() === 'admin@gmail.com';
    const metaRole =
      user && typeof user.user_metadata?.role === 'string'
        ? user.user_metadata.role.trim().toLowerCase()
        : null;
    setRole(isAdminEmail || metaRole === 'admin' ? 'admin' : metaRole);
  }, []);

  const loadStatsAndLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

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
      if (!message.includes('Oturum bulunamadı')) {
        Alert.alert('Yükleme hatası', message);
      }
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

  // Chart Data Preparation
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Taslak': 0,
      'Planlanıyor': 0,
      'Yayında': 0,
      'Tamamlandı': 0,
      'İptal': 0,
    };
    events.forEach(e => {
      if (counts[e.status] !== undefined) {
        counts[e.status]++;
      } else {
        counts[e.status] = 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [events]);

  const maxStatusCount = Math.max(...statusCounts.map(s => s.count), 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Taslak': return '#94A3B8'; // slate-400
      case 'Planlanıyor': return '#F59E0B'; // amber-500
      case 'Yayında': return '#3B82F6'; // blue-500
      case 'Tamamlandı': return '#10B981'; // emerald-500
      case 'İptal': return '#EF4444'; // red-500
      default: return '#64748B';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Taslak': return '#F1F5F9';
      case 'Planlanıyor': return '#FEF3C7';
      case 'Yayında': return '#DBEAFE';
      case 'Tamamlandı': return '#D1FAE5';
      case 'İptal': return '#FEE2E2';
      default: return '#F1F5F9';
    }
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

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statGridItem}>
          <Ionicons name="calendar-outline" size={24} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statGridLabel}>Toplam Etkinlik</Text>
          <Text style={styles.statGridValue}>{stats?.totalEvents ?? 0}</Text>
        </LinearGradient>
        <LinearGradient colors={['#10B981', '#059669']} style={styles.statGridItem}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statGridLabel}>Tamamlanan Etk.</Text>
          <Text style={styles.statGridValue}>{stats?.completedEvents ?? 0}</Text>
        </LinearGradient>
        <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.statGridItem}>
          <Ionicons name="people-outline" size={24} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statGridLabel}>Toplam Kullanıcı</Text>
          <Text style={styles.statGridValue}>{stats?.totalUsers ?? 0}</Text>
        </LinearGradient>
        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statGridItem}>
          <Ionicons name="list-outline" size={24} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statGridLabel}>Toplam Görev</Text>
          <Text style={styles.statGridValue}>{stats?.totalTasks ?? 0}</Text>
        </LinearGradient>
      </View>

      {/* Chart: Event Status */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Etkinlik Durumu Dağılımı</Text>
        <View style={styles.chartContainer}>
          {statusCounts.map((item, index) => {
            const percentage = maxStatusCount > 0 ? (item.count / maxStatusCount) * 100 : 0;
            return (
              <View key={index} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{item.name}</Text>
                <View style={styles.chartBarBackground}>
                  <View 
                    style={[
                      styles.chartBarFill, 
                      { width: `${percentage}%`, backgroundColor: getStatusColor(item.name) }
                    ]} 
                  />
                </View>
                <Text style={styles.chartValue}>{item.count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Chart: Task Completion */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Görev Tamamlama Oranı</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {stats?.completedTasks ?? 0} / {stats?.totalTasks ?? 0} Görev
            </Text>
            <Text style={styles.progressPercentage}>
              {stats?.totalTasks ? Math.round(((stats.completedTasks ?? 0) / stats.totalTasks) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${stats?.totalTasks ? ((stats.completedTasks ?? 0) / stats.totalTasks) * 100 : 0}%` }
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderEvents = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionSubtitle}>{events.length} etkinlik bulundu</Text>
      {events.map((event) => (
        <View key={event.id} style={styles.listCard}>
          <View style={styles.listCardMain}>
            <Text style={styles.listTitle}>{event.title}</Text>
            <View style={styles.listMetaRow}>
              <View style={[styles.badge, { backgroundColor: getStatusBgColor(event.status) }]}>
                <Text style={[styles.badgeText, { color: getStatusColor(event.status) }]}>
                  {event.status}
                </Text>
              </View>
              <Text style={styles.listDate}>
                {new Date(event.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <Pressable style={styles.deleteButton} onPress={() => handleDeleteEvent(event)}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </Pressable>
        </View>
      ))}
      {events.length === 0 && (
        <Text style={styles.emptyText}>Henüz etkinlik bulunmuyor.</Text>
      )}
    </View>
  );

  const renderUsers = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionSubtitle}>{users.length} kullanıcı kayıtlı</Text>
      {users.map((user) => (
        <View key={user.id} style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user.full_name || user.email)[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.full_name || 'İsimsiz Kullanıcı'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>
      ))}
      {users.length === 0 && (
        <Text style={styles.emptyText}>Henüz kullanıcı bulunmuyor.</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Kontrol Paneli</Text>
          <Text style={styles.headerSubtitle}>Sistem durumu ve istatistikler</Text>
        </View>
        {isLoading ? <ActivityIndicator size="small" color="#5B6CF6" /> : null}
      </View>

      {/* Custom Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Genel Bakış</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabButton, activeTab === 'events' && styles.tabButtonActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Etkinlikler</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Kullanıcılar</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadStatsAndLists();
            }}
            tintColor="#5B6CF6"
          />
        }
        showsVerticalScrollIndicator={false}>
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'events' && renderEvents()}
        {activeTab === 'users' && renderUsers()}

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
    color: '#64748B',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#5B6CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#5B6CF6',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  tabContent: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 30,
    fontSize: 15,
  },

  // Grid Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statGridItem: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 20,
    padding: 16,
  },
  statIcon: {
    opacity: 0.8,
    marginBottom: 12,
  },
  statGridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  statGridValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Charts
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  chartContainer: {
    gap: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chartLabel: {
    width: 85,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  chartBarBackground: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  chartValue: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },

  // Progress
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B6CF6',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#5B6CF6',
    borderRadius: 6,
  },

  // List Cards
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listCardMain: {
    flex: 1,
    paddingRight: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Cards
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B6CF6',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
  },
});
