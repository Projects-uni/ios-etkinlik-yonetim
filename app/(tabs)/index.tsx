import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const categories = ['Tümü', 'Konser', 'Konferans', 'Spor', 'Festival', 'Atölye', 'Diğer'] as const;


type EventItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  event_date: string;
};

function formatEventDate(dateString: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function getStatusColors(status: string) {
  switch (status) {
    case 'Yayında':
      return {
        background: '#DCFCE7',
        text: '#166534',
      };
    case 'Planlanıyor':
      return {
        background: '#DBEAFE',
        text: '#1D4ED8',
      };
    case 'Tamamlandı':
      return {
        background: '#E2E8F0',
        text: '#334155',
      };
    case 'İptal':
      return {
        background: '#FEE2E2',
        text: '#B91C1C',
      };
    default:
      return {
        background: '#FEF3C7',
        text: '#B45309',
      };
  }
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('Tümü');
  const [searchText, setSearchText] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [displayName, setDisplayName] = useState('kullanıcı');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scale = Math.min(Math.max(width / 390, 0.88), 1.08);
  const spacing = {
    horizontal: Math.round(20 * scale),
    searchHeight: Math.round(54 * scale),
    chipHorizontal: Math.round(18 * scale),
    chipVertical: Math.round(10 * scale),
  };

  const loadEvents = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, location, category, status, event_date')
        .order('event_date', { ascending: true });

      if (error) {
        throw error;
      }

      setEvents(data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlikler yüklenemedi.';
      Alert.alert('Yükleme hatası', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);

      if (!isMounted) {
        return;
      }

      const user = userData.user ?? sessionData.session?.user;

      if (!user) {
        setDisplayName('kullanıcı');
        return;
      }

      const metadataName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
      const emailName = user.email?.split('@')[0]?.trim() ?? '';
      setDisplayName(metadataName || emailName || 'kullanıcı');
    };

    loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      if (!session) {
        setDisplayName('kullanıcı');
        return;
      }

      const metadataName = typeof session.user.user_metadata?.full_name === 'string'
        ? session.user.user_metadata.full_name.trim()
        : '';
      const emailName = session.user.email?.split('@')[0]?.trim() ?? '';
      setDisplayName(metadataName || emailName || 'kullanıcı');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchText.trim().toLocaleLowerCase('tr-TR');

    return events.filter((event) => {
      const matchesCategory = activeCategory === 'Tümü' || event.category === activeCategory;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [event.title, event.description, event.location]
          .join(' ')
          .toLocaleLowerCase('tr-TR')
          .includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, events, searchText]);

  const router = useRouter();


  const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    Alert.alert('Çıkış başarısız', error.message);
    return;
  }
  router.replace('/'); // 👈 force navigate to auth screen
};

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.horizontal }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadEvents(true)} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.welcomeText, { fontSize: Math.round(16 * scale) }]}>
              Hoş Geldiniz {displayName}
            </Text>
            <Text style={[styles.title, { fontSize: Math.round(30 * scale) }]}>Etkinlikler</Text>
            
          </View>
          <Pressable
            style={[styles.iconButton, { width: 42 * scale, height: 42 * scale }]}
            onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={Math.round(20 * scale)} color="#334155" />
          </Pressable>
        </View>

        <View
          style={[
            styles.searchWrap,
            { height: spacing.searchHeight, borderRadius: spacing.searchHeight / 2 },
          ]}>
          <Ionicons name="search-outline" size={Math.round(20 * scale)} color="#94A3B8" />
          <TextInput
            placeholder="Etkinlik ara..."
            placeholderTextColor="#94A3B8"
            style={[styles.searchInput, { fontSize: Math.round(16 * scale) }]}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {categories.map((category) => {
            const isActive = activeCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setActiveCategory(category)}
                style={[
                  styles.categoryItem,
                  {
                    paddingHorizontal: spacing.chipHorizontal,
                    paddingVertical: spacing.chipVertical,
                  },
                  isActive && styles.categoryItemActive,
                ]}>
                <Text
                  style={[
                    styles.categoryText,
                    { fontSize: Math.round(14 * scale) },
                    isActive && styles.categoryTextActive,
                  ]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { fontSize: Math.round(28 * scale) }]}>
              Oluşturulan Etkinlikler
            </Text>
            <Text style={styles.sectionCaption}>{filteredEvents.length} kayıt gösteriliyor</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={() => loadEvents(true)}>
            <Ionicons name="refresh-outline" size={18} color="#2563EB" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Etkinlikler yükleniyor...</Text>
          </View>
        ) : null}

        {!isLoading && filteredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={30} color="#2563EB" />
            </View>
            <Text style={[styles.emptyTitle, { fontSize: Math.round(22 * scale) }]}>
              Henüz etkinlik görünmüyor
            </Text>
            <Text
              style={[
                styles.emptyText,
                { fontSize: Math.round(15 * scale), lineHeight: Math.round(22 * scale) },
              ]}>
              Oluştur sekmesinden ilk etkinliğini eklediğinde burada iPhone uyumlu kartlar halinde
              listelenecek.
            </Text>
          </View>
        ) : null}

        {!isLoading &&
          filteredEvents.map((event) => {
            const statusColors = getStatusColors(event.status);

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{event.category}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColors.background },
                    ]}>
                    <Text style={[styles.statusText, { color: statusColors.text }]}>{event.status}</Text>
                  </View>
                </View>

                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDescription} numberOfLines={3}>
                  {event.description}
                </Text>

                <View style={styles.metaList}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={16} color="#2563EB" />
                    <Text style={styles.metaText}>{formatEventDate(event.event_date)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={16} color="#2563EB" />
                    <Text style={styles.metaText}>{event.location}</Text>
                  </View>
                </View>
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingTop: 10,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  welcomeText: {
    marginBottom: 6,
    color: '#2563EB',
    fontWeight: '700',
  },
  title: {
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: '#64748B',
    fontWeight: '500',
  },
  iconButton: {
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#0F172A',
    fontWeight: '500',
  },
  categoryRow: {
    paddingBottom: 16,
    gap: 10,
  },
  categoryItem: {
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  categoryItemActive: {
    backgroundColor: '#2563EB',
  },
  categoryText: {
    color: '#475569',
    fontWeight: '700',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  sectionCaption: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    marginTop: 8,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 8,
    borderRadius: 24,
    paddingVertical: 30,
    paddingHorizontal: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#DBEAFE',
  },
  emptyTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  cardBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cardBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  eventTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  eventDescription: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  metaList: {
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
});
