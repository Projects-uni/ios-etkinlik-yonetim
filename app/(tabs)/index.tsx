import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
const editableCategories = categories.filter((category) => category !== 'Tümü');
const eventStatuses = ['Taslak', 'Planlanıyor', 'Yayında', 'Tamamlandı', 'İptal'] as const;

type EventCategory = (typeof editableCategories)[number];
type EventStatus = (typeof eventStatuses)[number];

type EventItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  status: EventStatus;
  event_date: string;
  budget: number | null;
};

type EventTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: string;
};

type EventParticipant = {
  id: string;
  email: string;
  invitation_status: string;
};

type EventDetails = {
  tasks: EventTask[];
  participants: EventParticipant[];
};

type EditFormState = {
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  status: EventStatus;
  budget: string;
  eventDate: Date;
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
    case 'Taslak':
      return {
        background: '#FEF3C7',
        text: '#B45309',
      };
    default:
      return {
        background: '#E2E8F0',
        text: '#475569',
      };
  }
}

function createEditFormState(event: EventItem): EditFormState {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    category: event.category,
    status: event.status,
    budget: event.budget === null ? '' : String(event.budget),
    eventDate: new Date(event.event_date),
  };
}

function formatBudget(value: number | null) {
  if (value === null) {
    return 'Belirtilmedi';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('Tümü');
  const [searchText, setSearchText] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [displayName, setDisplayName] = useState('kullanıcı');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

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
        .select('id, title, description, location, category, status, event_date, budget')
        .order('event_date', { ascending: true });

      if (error) {
        throw error;
      }

      setEvents((data ?? []) as EventItem[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlikler yüklenemedi.';
      Alert.alert('Yükleme hatası', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadEventDetails = useCallback(async (eventId: string) => {
    setIsDetailsLoading(true);

    try {
      const [tasksResponse, participantsResponse] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, assigned_to, due_date, status')
          .eq('event_id', eventId)
          .order('due_date', { ascending: true }),
        supabase
          .from('event_participants')
          .select('id, email, invitation_status')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
      ]);

      if (tasksResponse.error) {
        throw tasksResponse.error;
      }

      if (participantsResponse.error) {
        throw participantsResponse.error;
      }

      setEventDetails({
        tasks: tasksResponse.data ?? [],
        participants: participantsResponse.data ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlik detayları yüklenemedi.';
      Alert.alert('Detay yükleme hatası', message);
      setEventDetails({
        tasks: [],
        participants: [],
      });
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const closeDetails = useCallback(() => {
    setIsDetailsVisible(false);
    setSelectedEvent(null);
    setEventDetails(null);
    setIsEditing(false);
    setEditForm(null);
    setShowEditDatePicker(false);
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

      const metadataName =
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
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

      const metadataName =
        typeof session.user.user_metadata?.full_name === 'string'
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
    router.replace('/');
  };

  const handleOpenDetails = async (event: EventItem) => {
    setSelectedEvent(event);
    setEditForm(createEditFormState(event));
    setIsEditing(false);
    setEventDetails(null);
    setIsDetailsVisible(true);
    await loadEventDetails(event.id);
  };

  const handleStartEdit = (event: EventItem) => {
    setSelectedEvent(event);
    setEditForm(createEditFormState(event));
    setIsEditing(true);
    setIsDetailsVisible(true);
    if (!eventDetails || selectedEvent?.id !== event.id) {
      void loadEventDetails(event.id);
    }
  };

  const handleEditField = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleEditDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEditDatePicker(false);
    if (selectedDate) {
      handleEditField('eventDate', selectedDate);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent || !editForm) {
      return;
    }

    if (!editForm.title.trim() || !editForm.description.trim() || !editForm.location.trim()) {
      Alert.alert('Eksik bilgi', 'Etkinlik adı, açıklama ve konum alanları zorunludur.');
      return;
    }

    const parsedBudget =
      editForm.budget.trim().length > 0 ? Number.parseFloat(editForm.budget.replace(',', '.')) : null;

    if (parsedBudget !== null && Number.isNaN(parsedBudget)) {
      Alert.alert('Geçersiz bütçe', 'Bütçe alanına sayısal bir değer girin.');
      return;
    }

    setIsSaving(true);
    setBusyEventId(selectedEvent.id);

    try {
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        location: editForm.location.trim(),
        category: editForm.category,
        status: editForm.status,
        event_date: editForm.eventDate.toISOString(),
        budget: parsedBudget,
      };

      const { error } = await supabase.from('events').update(payload).eq('id', selectedEvent.id);

      if (error) {
        throw error;
      }

      const updatedEvent: EventItem = {
        id: selectedEvent.id,
        ...payload,
      };

      setEvents((current) => current.map((event) => (event.id === selectedEvent.id ? updatedEvent : event)));
      setSelectedEvent(updatedEvent);
      setEditForm(createEditFormState(updatedEvent));
      setIsEditing(false);
      Alert.alert('Başarılı', 'Etkinlik bilgileri güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlik güncellenemedi.';
      Alert.alert('Güncelleme hatası', message);
    } finally {
      setIsSaving(false);
      setBusyEventId(null);
    }
  };

  const deleteEvent = async (event: EventItem) => {
    setIsDeleting(true);
    setBusyEventId(event.id);

    try {
      const { error } = await supabase.from('events').delete().eq('id', event.id);

      if (error) {
        throw error;
      }

      setEvents((current) => current.filter((item) => item.id !== event.id));

      if (selectedEvent?.id === event.id) {
        closeDetails();
      }

      Alert.alert('Etkinlik Silindi');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlik silinemedi.';
      Alert.alert('Silme hatası', message);
    } finally {
      setIsDeleting(false);
      setBusyEventId(null);
    }
  };

  const confirmDelete = (event: EventItem) => {
    Alert.alert(
      'Etkinlik silinsin mi?',
      `"${event.title}" etkinliği ve ilişkili görev/katılımcı kayıtları silinecek.`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void deleteEvent(event);
          },
        },
      ]
    );
  };

  const renderActionButtons = (event: EventItem) => {
    const isBusy = busyEventId === event.id && (isDeleting || isSaving);

    return (
      <View style={styles.cardActionsRow}>
        <Pressable
          disabled={isBusy}
          onPress={() => handleStartEdit(event)}
          style={[styles.actionButton, styles.editButton]}>
          <Ionicons name="create-outline" size={16} color="#1D4ED8" />
          <Text style={[styles.actionButtonText, styles.editButtonText]}>Düzenle</Text>
        </Pressable>

        <Pressable
          disabled={isBusy}
          onPress={() => confirmDelete(event)}
          style={[styles.actionButton, styles.deleteButton]}>
          <Ionicons name="trash-outline" size={16} color="#B91C1C" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
            {isDeleting && busyEventId === event.id ? 'Siliniyor...' : 'Sil'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const detailStatusColors = selectedEvent ? getStatusColors(selectedEvent.status) : null;

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
                <Pressable onPress={() => handleOpenDetails(event)} style={styles.cardContentButton}>
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
                    <View style={styles.metaRow}>
                      <Ionicons name="cash-outline" size={16} color="#2563EB" />
                      <Text style={styles.metaText}>{formatBudget(event.budget)}</Text>
                    </View>
                  </View>
                </Pressable>

                {renderActionButtons(event)}
              </View>
            );
          })}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isDetailsVisible}
        onRequestClose={closeDetails}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>
                    {isEditing ? 'Etkinliği Düzenle' : selectedEvent?.title ?? 'Etkinlik Detayı'}
                  </Text>
                  {!isEditing && selectedEvent ? (
                    <Text style={styles.modalSubtitle}>Kartı kapatmadan tüm detayları inceleyin.</Text>
                  ) : null}
                </View>

                <Pressable onPress={closeDetails} style={styles.modalCloseButton}>
                  <Ionicons name="close-outline" size={24} color="#334155" />
                </Pressable>
              </View>

              {selectedEvent ? (
                <ScrollView
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.modalActionsRow}>
                    <Pressable
                      disabled={isSaving || isDeleting}
                      onPress={() => handleStartEdit(selectedEvent)}
                      style={[styles.actionButton, styles.editButton, styles.modalActionButton]}>
                      <Ionicons name="create-outline" size={16} color="#1D4ED8" />
                      <Text style={[styles.actionButtonText, styles.editButtonText]}>Düzenle</Text>
                    </Pressable>

                    <Pressable
                      disabled={isSaving || isDeleting}
                      onPress={() => confirmDelete(selectedEvent)}
                      style={[styles.actionButton, styles.deleteButton, styles.modalActionButton]}>
                      <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                      <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                        {isDeleting ? 'Siliniyor...' : 'Sil'}
                      </Text>
                    </Pressable>
                  </View>

                  {isEditing && editForm ? (
                    <View style={styles.editSection}>
                      <TextInput
                        placeholder="Etkinlik adı"
                        placeholderTextColor="#94A3B8"
                        style={styles.modalInput}
                        value={editForm.title}
                        onChangeText={(value) => handleEditField('title', value)}
                      />

                      <TextInput
                        placeholder="Açıklama"
                        placeholderTextColor="#94A3B8"
                        style={[styles.modalInput, styles.modalTextArea]}
                        multiline
                        value={editForm.description}
                        onChangeText={(value) => handleEditField('description', value)}
                      />

                      <TextInput
                        placeholder="Konum"
                        placeholderTextColor="#94A3B8"
                        style={styles.modalInput}
                        value={editForm.location}
                        onChangeText={(value) => handleEditField('location', value)}
                      />

                      <View style={styles.modalPickerWrap}>
                        <Text style={styles.modalFieldLabel}>Kategori</Text>
                        <Picker
                          selectedValue={editForm.category}
                          onValueChange={(value) => handleEditField('category', value as EventCategory)}>
                          {editableCategories.map((category) => (
                            <Picker.Item key={category} label={category} value={category} />
                          ))}
                        </Picker>
                      </View>

                      <View style={styles.modalPickerWrap}>
                        <Text style={styles.modalFieldLabel}>Durum</Text>
                        <Picker
                          selectedValue={editForm.status}
                          onValueChange={(value) => handleEditField('status', value as EventStatus)}>
                          {eventStatuses.map((status) => (
                            <Picker.Item key={status} label={status} value={status} />
                          ))}
                        </Picker>
                      </View>

                      <TextInput
                        placeholder="Bütçe"
                        placeholderTextColor="#94A3B8"
                        style={styles.modalInput}
                        keyboardType="decimal-pad"
                        value={editForm.budget}
                        onChangeText={(value) => handleEditField('budget', value)}
                      />

                      <Text style={styles.modalFieldLabel}>Etkinlik Tarihi</Text>
                      <Pressable
                        onPress={() => setShowEditDatePicker(true)}
                        style={styles.dateButton}>
                        <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                        <Text style={styles.dateButtonText}>{formatEventDate(editForm.eventDate.toISOString())}</Text>
                      </Pressable>

                      {showEditDatePicker ? (
                        <DateTimePicker
                          mode="datetime"
                          display="default"
                          value={editForm.eventDate}
                          onChange={handleEditDateChange}
                        />
                      ) : null}

                      <View style={styles.editFooterRow}>
                        <Pressable
                          disabled={isSaving}
                          onPress={() => {
                            setIsEditing(false);
                            setEditForm(createEditFormState(selectedEvent));
                            setShowEditDatePicker(false);
                          }}
                          style={[styles.actionButton, styles.cancelButton]}>
                          <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Vazgeç</Text>
                        </Pressable>

                        <Pressable
                          disabled={isSaving}
                          onPress={handleSaveEdit}
                          style={[styles.actionButton, styles.saveButton]}>
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                              <Text style={[styles.actionButtonText, styles.saveButtonText]}>Kaydet</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.detailHero}>
                        <View style={styles.cardBadge}>
                          <Text style={styles.cardBadgeText}>{selectedEvent.category}</Text>
                        </View>
                        {detailStatusColors ? (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: detailStatusColors.background },
                            ]}>
                            <Text style={[styles.statusText, { color: detailStatusColors.text }]}>
                              {selectedEvent.status}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.detailDescription}>{selectedEvent.description}</Text>

                      <View style={styles.detailInfoGrid}>
                        <View style={styles.detailInfoCard}>
                          <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                          <Text style={styles.detailInfoLabel}>Tarih</Text>
                          <Text style={styles.detailInfoValue}>{formatEventDate(selectedEvent.event_date)}</Text>
                        </View>

                        <View style={styles.detailInfoCard}>
                          <Ionicons name="location-outline" size={18} color="#2563EB" />
                          <Text style={styles.detailInfoLabel}>Konum</Text>
                          <Text style={styles.detailInfoValue}>{selectedEvent.location}</Text>
                        </View>

                        <View style={styles.detailInfoCard}>
                          <Ionicons name="cash-outline" size={18} color="#2563EB" />
                          <Text style={styles.detailInfoLabel}>Bütçe</Text>
                          <Text style={styles.detailInfoValue}>{formatBudget(selectedEvent.budget)}</Text>
                        </View>
                      </View>

                      {isDetailsLoading ? (
                        <View style={styles.detailsLoadingWrap}>
                          <ActivityIndicator size="small" color="#2563EB" />
                          <Text style={styles.loadingText}>Detaylar yükleniyor...</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.detailSection}>
                            <Text style={styles.detailSectionTitle}>Görevler</Text>
                            {eventDetails?.tasks.length ? (
                              eventDetails.tasks.map((task) => (
                                <View key={task.id} style={styles.detailListCard}>
                                  <View style={styles.detailListHeader}>
                                    <Text style={styles.detailListTitle}>{task.title}</Text>
                                    <Text style={styles.detailTaskStatus}>{task.status}</Text>
                                  </View>
                                  <Text style={styles.detailListText}>
                                    {task.description || 'Açıklama girilmedi.'}
                                  </Text>
                                  <Text style={styles.detailListMeta}>
                                    Atanan: {task.assigned_to || 'Belirtilmedi'}
                                  </Text>
                                  <Text style={styles.detailListMeta}>
                                    Bitiş: {task.due_date ? formatEventDate(task.due_date) : 'Belirtilmedi'}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.detailEmptyText}>Bu etkinlik için görev eklenmemiş.</Text>
                            )}
                          </View>

                          <View style={styles.detailSection}>
                            <Text style={styles.detailSectionTitle}>Katılımcılar</Text>
                            {eventDetails?.participants.length ? (
                              eventDetails.participants.map((participant) => (
                                <View key={participant.id} style={styles.detailListCard}>
                                  <Text style={styles.detailListTitle}>{participant.email}</Text>
                                  <Text style={styles.detailListMeta}>
                                    Davet durumu: {participant.invitation_status}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.detailEmptyText}>Bu etkinlik için katılımcı eklenmemiş.</Text>
                            )}
                          </View>
                        </>
                      )}
                    </>
                  )}
                </ScrollView>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
  cardContentButton: {
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    gap: 10,
  },
  cardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
  },
  cardBadgeText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  eventTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  eventDescription: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
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
  cardActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
  editButtonText: {
    color: '#1D4ED8',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#B91C1C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSafeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingBottom: 16,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  modalActionButton: {
    flex: 1,
  },
  detailHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  detailDescription: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  detailInfoGrid: {
    gap: 12,
    marginBottom: 20,
  },
  detailInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 6,
  },
  detailInfoLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  detailInfoValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  detailsLoadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  detailSection: {
    marginTop: 6,
    marginBottom: 18,
  },
  detailSectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 6,
    marginBottom: 10,
  },
  detailListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailListTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  detailTaskStatus: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  detailListText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  detailListMeta: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  detailEmptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  editSection: {
    gap: 14,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
  },
  modalTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalPickerWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    borderRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  modalFieldLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  dateButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  editFooterRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#475569',
  },
  saveButton: {
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    color: '#FFFFFF',
  },
});
