import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
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

const categories = ['Tümü', 'Konser', 'Konferans', 'Spor', 'Festival', 'Atölye'];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const scale = Math.min(Math.max(width / 390, 0.88), 1.12);
  const spacing = {
    horizontal: Math.round(20 * scale),
    searchHeight: Math.round(54 * scale),
    chipHorizontal: Math.round(18 * scale),
    chipVertical: Math.round(10 * scale),
  };

  // Events will come from backend after event-create flow is completed.
  const featuredEvents = useMemo(() => [] as Array<unknown>, []);
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Çıkış başarısız', error.message);
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.horizontal }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, { fontSize: Math.round(30 * scale) }]}>EventHub</Text>
            <Text style={[styles.subtitle, { fontSize: Math.round(15 * scale) }]}>
              Yakındaki etkinlikleri keşfet
            </Text>
          </View>
          <Pressable
            style={[styles.iconButton, { width: 40 * scale, height: 40 * scale }]}
            onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={Math.round(20 * scale)} color="#4B5563" />
          </Pressable>
        </View>

        <View style={[styles.searchWrap, { height: spacing.searchHeight, borderRadius: spacing.searchHeight / 2 }]}>
          <Ionicons name="search-outline" size={Math.round(20 * scale)} color="#94A3B8" />
          <TextInput
            placeholder="Etkinlik ara..."
            placeholderTextColor="#94A3B8"
            style={[styles.searchInput, { fontSize: Math.round(16 * scale) }]}
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
                style={styles.categoryItem}>
                {isActive ? (
                  <LinearGradient
                    colors={['#3B82F6', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.categoryPillActive,
                      {
                        borderRadius: Math.round(22 * scale),
                        paddingHorizontal: spacing.chipHorizontal,
                        paddingVertical: spacing.chipVertical,
                      },
                    ]}>
                    <Text style={[styles.categoryTextActive, { fontSize: Math.round(15 * scale) }]}>
                      {category}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.categoryPill,
                      {
                        borderRadius: Math.round(22 * scale),
                        paddingHorizontal: spacing.chipHorizontal,
                        paddingVertical: spacing.chipVertical,
                      },
                    ]}>
                    <Text style={[styles.categoryText, { fontSize: Math.round(15 * scale) }]}>{category}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: Math.round(30 * scale) }]}>Öne Çıkan Etkinlikler</Text>
          <Pressable>
            <Text style={[styles.sectionAction, { fontSize: Math.round(16 * scale) }]}>Tümünü Gör</Text>
          </Pressable>
        </View>

        {featuredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <LinearGradient
              colors={['#EEF2FF', '#E0E7FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.emptyIconWrap,
                {
                  width: Math.round(72 * scale),
                  height: Math.round(72 * scale),
                  borderRadius: Math.round(20 * scale),
                },
              ]}>
              <Ionicons name="calendar-outline" size={Math.round(30 * scale)} color="#4F46E5" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { fontSize: Math.round(22 * scale) }]}>Henüz etkinlik yok</Text>
            <Text style={[styles.emptyText, { fontSize: Math.round(15 * scale), lineHeight: Math.round(22 * scale) }]}>
              Etkinlik oluşturma kısmı tamamlandığında burada listelenecek.
            </Text>
          </View>
        ) : null}
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
    paddingBottom: 28,
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
  title: {
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 18,
    color: '#64748B',
    fontWeight: '500',
  },
  iconButton: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    height: 54,
    borderRadius: 28,
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
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '500',
  },
  categoryRow: {
    paddingBottom: 14,
    gap: 10,
  },
  categoryItem: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  categoryPill: {
    backgroundColor: '#E5E7EB',
  },
  categoryPillActive: {
  },
  categoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextActive: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  sectionAction: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 18,
  },
  emptyCard: {
    marginTop: 8,
    borderRadius: 26,
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
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
