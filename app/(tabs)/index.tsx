import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import '@/components/auth-screen';

import { supabase } from '@/lib/supabase';

const categories = ['Tümü', 'Konser', 'Konferans', 'Spor', 'Festival', 'Atölye', 'Diğer'] as const;
const editableCategories = categories.filter((category) => category !== 'Tümü');
const eventStatuses = ['Taslak', 'Planlanıyor', 'Yayında', 'Tamamlandı', 'İptal'] as const;
const taskStatuses = ['Beklemede', 'Devam Ediyor', 'Tamamlandı'] as const;
const participantStatuses = ['invited', 'accepted', 'declined'] as const;

type EventCategory = (typeof editableCategories)[number];
type EventStatus = (typeof eventStatuses)[number];
type TaskStatus = (typeof taskStatuses)[number];
type ParticipantStatus = (typeof participantStatuses)[number];

type EventItem = {
  id: string;
  organizer_id: string;
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
  assigned_to_user_id: string | null;
  due_date: string | null;
  status: TaskStatus;
};

type EventParticipant = {
  id: string;
  email: string;
  invitation_status: ParticipantStatus;
};

type EventDetails = {
  tasks: EventTask[];
  participants: EventParticipant[];
  participantCount: number;
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

type TaskEditFormState = {
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  dueDate: Date | null;
};

type ParticipantEditFormState = {
  email: string;
  invitationStatus: ParticipantStatus;
};

type CurrentUser = {
  id: string;
  email: string;
};

type UserLookupRow = {
  id: string;
  email: string;
  full_name: string | null;
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

function createTaskEditFormState(task: EventTask): TaskEditFormState {
  return {
    title: task.title,
    description: task.description ?? '',
    assignedTo: task.assigned_to ?? '',
    status: task.status,
    dueDate: task.due_date ? new Date(task.due_date) : null,
  };
}

async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.rpc('find_user_by_email', {
    input_email: normalizedEmail,
  });

  if (error) {
    throw error;
  }

  const [user] = (data ?? []) as UserLookupRow[];
  return user ?? null;
}

function createParticipantEditFormState(participant: EventParticipant): ParticipantEditFormState {
  return {
    email: participant.email,
    invitationStatus: participant.invitation_status,
  };
}

function createEmptyTaskFormState(): TaskEditFormState {
  return {
    title: '',
    description: '',
    assignedTo: '',
    status: 'Beklemede',
    dueDate: null,
  };
}

function createEmptyParticipantFormState(): ParticipantEditFormState {
  return {
    email: '',
    invitationStatus: 'invited',
  };
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('Tümü');
  const [searchText, setSearchText] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [displayName, setDisplayName] = useState('kullanıcı');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [participantStatusByEventId, setParticipantStatusByEventId] = useState<Record<string, ParticipantStatus>>({});
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditForm, setTaskEditForm] = useState<TaskEditFormState | null>(null);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<TaskEditFormState | null>(null);
  const [showNewTaskDatePicker, setShowNewTaskDatePicker] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [participantEditForm, setParticipantEditForm] = useState<ParticipantEditFormState | null>(null);
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);
  const [newParticipantForm, setNewParticipantForm] = useState<ParticipantEditFormState | null>(null);
  const [busyDetailItemId, setBusyDetailItemId] = useState<string | null>(null);
  const [isSavingDetailItem, setIsSavingDetailItem] = useState(false);
  const [isDeletingDetailItem, setIsDeletingDetailItem] = useState(false);

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
        .select('id, organizer_id, title, description, location, category, status, event_date, budget')
        .order('event_date', { ascending: true });

      if (error) {
        throw error;
      }

      const nextEvents = (data ?? []) as EventItem[];
      setEvents(nextEvents);

      if (currentUser && nextEvents.length > 0) {
        const { data: participantRows, error: participantRowsError } = await supabase
          .from('event_participants')
          .select('event_id, invitation_status')
          .eq('participant_user_id', currentUser.id)
          .in(
            'event_id',
            nextEvents.map((event) => event.id)
          );

        if (participantRowsError) {
          throw participantRowsError;
        }

        setParticipantStatusByEventId(
          Object.fromEntries(
            (participantRows ?? []).map((row) => [row.event_id as string, row.invitation_status as ParticipantStatus])
          )
        );
      } else {
        setParticipantStatusByEventId({});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlikler yüklenemedi.';
      Alert.alert('Yükleme hatası', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  const loadEventDetails = useCallback(async (eventId: string, isOwner: boolean) => {
    setIsDetailsLoading(true);

    try {
      const [tasksResponse, participantCountResponse, participantsResponse] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, assigned_to, assigned_to_user_id, due_date, status')
          .eq('event_id', eventId)
          .order('due_date', { ascending: true }),
        supabase.rpc('get_event_participant_count', {
          input_event_id: eventId,
        }),
        isOwner
          ? supabase
              .from('event_participants')
              .select('id, email, invitation_status')
              .eq('event_id', eventId)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (tasksResponse.error) {
        throw tasksResponse.error;
      }

      if (participantCountResponse.error) {
        throw participantCountResponse.error;
      }

      if (participantsResponse.error) {
        throw participantsResponse.error;
      }

      setEventDetails({
        tasks: tasksResponse.data ?? [],
        participants: participantsResponse.data ?? [],
        participantCount: participantCountResponse.data ?? 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Etkinlik detayları yüklenemedi.';
      Alert.alert('Detay yükleme hatası', message);
      setEventDetails({
        tasks: [],
        participants: [],
        participantCount: 0,
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
    setEditingTaskId(null);
    setTaskEditForm(null);
    setShowTaskDatePicker(false);
    setIsCreatingTask(false);
    setNewTaskForm(null);
    setShowNewTaskDatePicker(false);
    setEditingParticipantId(null);
    setParticipantEditForm(null);
    setIsCreatingParticipant(false);
    setNewParticipantForm(null);
    setBusyDetailItemId(null);
    setIsSavingDetailItem(false);
    setIsDeletingDetailItem(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  useEffect(() => {
    if (currentUser) {
      void loadEvents();
    }
  }, [currentUser, loadEvents]);

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
        setCurrentUser(null);
        return;
      }

      const metadataName =
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
      const emailName = user.email?.split('@')[0]?.trim() ?? '';
      setDisplayName(metadataName || emailName || 'kullanıcı');
      if (user.email) {
        setCurrentUser({
          id: user.id,
          email: user.email.trim().toLowerCase(),
        });
      }
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
        setCurrentUser(null);
        return;
      }

      const metadataName =
        typeof session.user.user_metadata?.full_name === 'string'
          ? session.user.user_metadata.full_name.trim()
          : '';
      const emailName = session.user.email?.split('@')[0]?.trim() ?? '';
      setDisplayName(metadataName || emailName || 'kullanıcı');
      if (session.user.email) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email.trim().toLowerCase(),
        });
      }
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

  const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    Alert.alert('Çıkış başarısız', error.message);
    return;
  }
  if (Platform.OS === 'web') {
    window.location.href = '/';
  } else {
    // Force reload on native too
    const { DevSettings } = require('react-native');
    DevSettings.reload();
  }
};

  const handleOpenDetails = async (event: EventItem) => {
    const isOwner = currentUser?.id === event.organizer_id;
    setSelectedEvent(event);
    setEditForm(createEditFormState(event));
    setIsEditing(false);
    setEventDetails(null);
    setIsDetailsVisible(true);
    await loadEventDetails(event.id, isOwner);
  };

  const handleStartEdit = (event: EventItem) => {
    const isOwner = currentUser?.id === event.organizer_id;
    setSelectedEvent(event);
    setEditForm(createEditFormState(event));
    setIsEditing(true);
    setIsDetailsVisible(true);
    if (!eventDetails || selectedEvent?.id !== event.id) {
      void loadEventDetails(event.id, isOwner);
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

  const handleTaskDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTaskDatePicker(false);
    if (selectedDate) {
      setTaskEditForm((current) => (current ? { ...current, dueDate: selectedDate } : current));
    }
  };

  const handleNewTaskDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowNewTaskDatePicker(false);
    if (selectedDate) {
      setNewTaskForm((current) => (current ? { ...current, dueDate: selectedDate } : current));
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
        organizer_id: selectedEvent.organizer_id,
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

  const handleStartTaskEdit = (task: EventTask) => {
    setIsCreatingTask(false);
    setNewTaskForm(null);
    setShowNewTaskDatePicker(false);
    setEditingTaskId(task.id);
    setTaskEditForm(createTaskEditFormState(task));
    setShowTaskDatePicker(false);
  };

  const handleCancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskEditForm(null);
    setShowTaskDatePicker(false);
  };

  const handleStartCreateTask = () => {
    setEditingTaskId(null);
    setTaskEditForm(null);
    setShowTaskDatePicker(false);
    setIsCreatingTask(true);
    setNewTaskForm(createEmptyTaskFormState());
  };

  const handleCancelCreateTask = () => {
    setIsCreatingTask(false);
    setNewTaskForm(null);
    setShowNewTaskDatePicker(false);
  };

  const handleSaveTaskEdit = async (taskId: string) => {
    if (!taskEditForm) {
      return;
    }

    const editingTask = eventDetails?.tasks.find((task) => task.id === taskId);
    const isOwnTaskOnlyEdit =
      !isSelectedEventOwner && Boolean(currentUser && editingTask?.assigned_to_user_id === currentUser.id);

    if (!isOwnTaskOnlyEdit && (!taskEditForm.title.trim() || !taskEditForm.description.trim() || !taskEditForm.assignedTo.trim())) {
      Alert.alert('Eksik bilgi', 'Görev adı, açıklama ve atanan kişi alanları zorunludur.');
      return;
    }

    if (!taskEditForm.dueDate) {
      Alert.alert('Eksik bilgi', 'Görev için bir bitiş tarihi seçin.');
      return;
    }

    setIsSavingDetailItem(true);
    setBusyDetailItemId(taskId);

    try {
      let payload:
        | {
            title: string;
            description: string;
            assigned_to: string;
            assigned_to_user_id: string;
            status: TaskStatus;
            due_date: string;
          }
        | {
            status: TaskStatus;
            due_date: string;
          };

      if (isOwnTaskOnlyEdit) {
        payload = {
          status: taskEditForm.status,
          due_date: taskEditForm.dueDate.toISOString(),
        };
      } else {
        const assignedUser = await findUserByEmail(taskEditForm.assignedTo);

        if (!assignedUser) {
          throw new Error(`"${taskEditForm.assignedTo}" için kullanıcı bulunamadı.`);
        }

        payload = {
          title: taskEditForm.title.trim(),
          description: taskEditForm.description.trim(),
          assigned_to: assignedUser.email,
          assigned_to_user_id: assignedUser.id,
          status: taskEditForm.status,
          due_date: taskEditForm.dueDate.toISOString(),
        };
      }

      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...payload } : task)),
            }
          : current
      );

      handleCancelTaskEdit();
      Alert.alert('Başarılı', 'Görev güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Görev güncellenemedi.';
      Alert.alert('Güncelleme hatası', message);
    } finally {
      setIsSavingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsDeletingDetailItem(true);
    setBusyDetailItemId(taskId);

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.filter((task) => task.id !== taskId),
            }
          : current
      );

      if (editingTaskId === taskId) {
        handleCancelTaskEdit();
      }

      Alert.alert('Silindi', 'Görev silindi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Görev silinemedi.';
      Alert.alert('Silme hatası', message);
    } finally {
      setIsDeletingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedEvent || !newTaskForm) {
      return;
    }

    if (!newTaskForm.title.trim() || !newTaskForm.description.trim() || !newTaskForm.assignedTo.trim()) {
      Alert.alert('Eksik bilgi', 'Görev adı, açıklama ve atanan kişi alanları zorunludur.');
      return;
    }

    if (!newTaskForm.dueDate) {
      Alert.alert('Eksik bilgi', 'Görev için bir bitiş tarihi seçin.');
      return;
    }

    setIsSavingDetailItem(true);
    setBusyDetailItemId('new-task');

    try {
      const assignedUser = await findUserByEmail(newTaskForm.assignedTo);

      if (!assignedUser) {
        throw new Error(`"${newTaskForm.assignedTo}" için kullanıcı bulunamadı.`);
      }

      const payload = {
        event_id: selectedEvent.id,
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim(),
        assigned_to: assignedUser.email,
        assigned_to_user_id: assignedUser.id,
        status: newTaskForm.status,
        due_date: newTaskForm.dueDate.toISOString(),
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select('id, title, description, assigned_to, assigned_to_user_id, due_date, status')
        .single();

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              tasks: [...current.tasks, data as EventTask].sort((a, b) => {
                const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
              }),
            }
          : current
      );

      handleCancelCreateTask();
      Alert.alert('Başarılı', 'Yeni görev eklendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Görev eklenemedi.';
      Alert.alert('Kayıt hatası', message);
    } finally {
      setIsSavingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const confirmDeleteTask = (task: EventTask) => {
    Alert.alert('Görev silinsin mi?', `"${task.title}" görevi silinecek.`, [
      {
        text: 'Vazgeç',
        style: 'cancel',
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void handleDeleteTask(task.id);
        },
      },
    ]);
  };

  const handleStartParticipantEdit = (participant: EventParticipant) => {
    setIsCreatingParticipant(false);
    setNewParticipantForm(null);
    setEditingParticipantId(participant.id);
    setParticipantEditForm(createParticipantEditFormState(participant));
  };

  const handleCancelParticipantEdit = () => {
    setEditingParticipantId(null);
    setParticipantEditForm(null);
  };

  const handleStartCreateParticipant = () => {
    setEditingParticipantId(null);
    setParticipantEditForm(null);
    setIsCreatingParticipant(true);
    setNewParticipantForm(createEmptyParticipantFormState());
  };

  const handleCancelCreateParticipant = () => {
    setIsCreatingParticipant(false);
    setNewParticipantForm(null);
  };

  const handleSaveParticipantEdit = async (participantId: string) => {
    if (!participantEditForm) {
      return;
    }

    const normalizedEmail = participantEditForm.email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Eksik bilgi', 'Katılımcı e-postası zorunludur.');
      return;
    }

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isEmailValid) {
      Alert.alert('Geçersiz e-posta', 'Katılımcı için geçerli bir e-posta adresi girin.');
      return;
    }

    setIsSavingDetailItem(true);
    setBusyDetailItemId(participantId);

    try {
      const existingParticipant = eventDetails?.participants.find((participant) => participant.id === participantId);
      const participantUser = await findUserByEmail(normalizedEmail);

      if (!participantUser) {
        throw new Error(`"${normalizedEmail}" için kullanıcı bulunamadı.`);
      }

      const payload = {
        email: participantUser.email,
        participant_user_id: participantUser.id,
        invitation_status: participantEditForm.invitationStatus,
      };

      const { error } = await supabase.from('event_participants').update(payload).eq('id', participantId);

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              participants: current.participants.map((participant) =>
                participant.id === participantId
                  ? { ...participant, email: payload.email, invitation_status: payload.invitation_status }
                  : participant
              ),
              participantCount:
                current.participantCount +
                ((existingParticipant?.invitation_status === 'declined' ? 0 : 1) ===
                (payload.invitation_status === 'declined' ? 0 : 1)
                  ? 0
                  : payload.invitation_status === 'declined'
                    ? -1
                    : 1),
            }
          : current
      );

      handleCancelParticipantEdit();
      Alert.alert('Başarılı', 'Katılımcı güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Katılımcı güncellenemedi.';
      Alert.alert('Güncelleme hatası', message);
    } finally {
      setIsSavingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    setIsDeletingDetailItem(true);
    setBusyDetailItemId(participantId);

    try {
      const existingParticipant = eventDetails?.participants.find((participant) => participant.id === participantId);
      const { error } = await supabase.from('event_participants').delete().eq('id', participantId);

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              participants: current.participants.filter((participant) => participant.id !== participantId),
              participantCount: Math.max(
                0,
                current.participantCount - (existingParticipant?.invitation_status === 'declined' ? 0 : 1)
              ),
            }
          : current
      );

      if (editingParticipantId === participantId) {
        handleCancelParticipantEdit();
      }

      Alert.alert('Silindi', 'Katılımcı silindi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Katılımcı silinemedi.';
      Alert.alert('Silme hatası', message);
    } finally {
      setIsDeletingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const handleCreateParticipant = async () => {
    if (!selectedEvent || !newParticipantForm) {
      return;
    }

    const normalizedEmail = newParticipantForm.email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Eksik bilgi', 'Katılımcı e-postası zorunludur.');
      return;
    }

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isEmailValid) {
      Alert.alert('Geçersiz e-posta', 'Katılımcı için geçerli bir e-posta adresi girin.');
      return;
    }

    setIsSavingDetailItem(true);
    setBusyDetailItemId('new-participant');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('Katılımcı eklemek için giriş yapmanız gerekiyor.');
      }

      const participantUser = await findUserByEmail(normalizedEmail);

      if (!participantUser) {
        throw new Error(`"${normalizedEmail}" için kullanıcı bulunamadı.`);
      }

      const payload = {
        event_id: selectedEvent.id,
        email: participantUser.email,
        participant_user_id: participantUser.id,
        invitation_status: newParticipantForm.invitationStatus,
        invited_by: user.id,
      };

      const { data, error } = await supabase
        .from('event_participants')
        .insert(payload)
        .select('id, email, invitation_status')
        .single();

      if (error) {
        throw error;
      }

      setEventDetails((current) =>
        current
          ? {
              ...current,
              participants: [...current.participants, data as EventParticipant],
              participantCount:
                current.participantCount + (newParticipantForm.invitationStatus === 'declined' ? 0 : 1),
            }
          : current
      );

      handleCancelCreateParticipant();
      Alert.alert('Başarılı', 'Yeni katılımcı eklendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Katılımcı eklenemedi.';
      Alert.alert('Kayıt hatası', message);
    } finally {
      setIsSavingDetailItem(false);
      setBusyDetailItemId(null);
    }
  };

  const confirmDeleteParticipant = (participant: EventParticipant) => {
    Alert.alert('Katılımcı silinsin mi?', `"${participant.email}" kaydı silinecek.`, [
      {
        text: 'Vazgeç',
        style: 'cancel',
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void handleDeleteParticipant(participant.id);
        },
      },
    ]);
  };

  const handleInvitationResponse = async (
    event: EventItem,
    response: Extract<ParticipantStatus, 'accepted' | 'declined'>
  ) => {
    setBusyEventId(event.id);

    try {
      const { error } = await supabase.rpc('respond_to_invitation', {
        input_event_id: event.id,
        input_response: response,
      });

      if (error) {
        throw error;
      }

      if (response === 'declined') {
        setEvents((current) => current.filter((item) => item.id !== event.id));
        setParticipantStatusByEventId((current) => {
          const next = { ...current };
          delete next[event.id];
          return next;
        });
        if (selectedEvent?.id === event.id) {
          closeDetails();
        }
      } else {
        setParticipantStatusByEventId((current) => ({
          ...current,
          [event.id]: 'accepted',
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Davet yanıtı kaydedilemedi.';
      Alert.alert('İşlem hatası', message);
    } finally {
      setBusyEventId(null);
    }
  };

  const renderActionButtons = (event: EventItem) => {
    if (currentUser?.id !== event.organizer_id) {
      return null;
    }

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
  const isSelectedEventOwner = Boolean(currentUser && selectedEvent?.organizer_id === currentUser.id);
  const selectedEventInvitationStatus = selectedEvent
    ? participantStatusByEventId[selectedEvent.id] ?? null
    : null;

  const canCurrentUserEditTask = useCallback(
    (task: EventTask) =>
      Boolean(currentUser && (isSelectedEventOwner || task.assigned_to_user_id === currentUser.id)),
    [currentUser, isSelectedEventOwner]
  );

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
            const invitationStatus = participantStatusByEventId[event.id];
            const showInvitationPrompt = invitationStatus === 'invited';
            const isRespondingToInvite = busyEventId === event.id;

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

                {showInvitationPrompt ? (
                  <View style={styles.cardActionsRow}>
                    <Pressable
                      disabled={isRespondingToInvite}
                      onPress={() => void handleInvitationResponse(event, 'accepted')}
                      style={[styles.actionButton, styles.saveButton]}>
                      <Text style={[styles.actionButtonText, styles.saveButtonText]}>Kabul Et</Text>
                    </Pressable>
                    <Pressable
                      disabled={isRespondingToInvite}
                      onPress={() => void handleInvitationResponse(event, 'declined')}
                      style={[styles.actionButton, styles.deleteButton]}>
                      <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Reddet</Text>
                    </Pressable>
                  </View>
                ) : (
                  renderActionButtons(event)
                )}
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
                  {isSelectedEventOwner ? (
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
                  ) : selectedEventInvitationStatus === 'invited' ? (
                    <View style={styles.modalActionsRow}>
                      <Pressable
                        disabled={busyEventId === selectedEvent.id}
                        onPress={() => void handleInvitationResponse(selectedEvent, 'accepted')}
                        style={[styles.actionButton, styles.saveButton, styles.modalActionButton]}>
                        <Text style={[styles.actionButtonText, styles.saveButtonText]}>Kabul Et</Text>
                      </Pressable>
                      <Pressable
                        disabled={busyEventId === selectedEvent.id}
                        onPress={() => void handleInvitationResponse(selectedEvent, 'declined')}
                        style={[styles.actionButton, styles.deleteButton, styles.modalActionButton]}>
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Reddet</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {isEditing && editForm ? (
                    <View style={styles.editSection}>
<Text style={styles.modalFieldLabel}>Etkinlik adı</Text>
                      <TextInput
                        placeholder="Etkinlik adı"
                        placeholderTextColor="#94A3B8"
                        style={styles.modalInput}
                        value={editForm.title}
                        onChangeText={(value) => handleEditField('title', value)}
                      />
<Text style={styles.modalFieldLabel}>Açıklama</Text>
                      <TextInput
                        placeholder="Açıklama"
                        placeholderTextColor="#94A3B8"
                        style={[styles.modalInput, styles.modalTextArea]}
                        multiline
                        value={editForm.description}
                        onChangeText={(value) => handleEditField('description', value)}
                      />
<Text style={styles.modalFieldLabel}>Konum</Text>
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
<Text style={styles.modalFieldLabel}>Bütçe</Text>
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
                            <View style={styles.detailSectionHeader}>
                              <Text style={styles.detailSectionTitle}>Görevler</Text>
                              {isSelectedEventOwner ? (
                                <Pressable
                                  disabled={isSavingDetailItem || isCreatingTask}
                                  onPress={handleStartCreateTask}
                                  style={styles.sectionAddButton}>
                                  <Ionicons name="add-outline" size={18} color="#2563EB" />
                                </Pressable>
                              ) : null}
                            </View>

                            {isSelectedEventOwner && isCreatingTask && newTaskForm ? (
                              <View style={styles.detailListCard}>
                                <View style={styles.inlineEditSection}>
                                  <View style={styles.inlineEditHeader}>
                                    <Text style={styles.detailListTitle}>Yeni Görev</Text>
                                  </View>

                                  <Text style={styles.modalFieldLabel}>Görev adı</Text>
                                  <TextInput
                                    placeholder="Görev adı"
                                    placeholderTextColor="#94A3B8"
                                    style={styles.modalInput}
                                    value={newTaskForm.title}
                                    onChangeText={(value) =>
                                      setNewTaskForm((current) =>
                                        current ? { ...current, title: value } : current
                                      )
                                    }
                                  />

                                  <Text style={styles.modalFieldLabel}>Açıklama</Text>
                                  <TextInput
                                    placeholder="Açıklama"
                                    placeholderTextColor="#94A3B8"
                                    style={[styles.modalInput, styles.compactTextArea]}
                                    multiline
                                    value={newTaskForm.description}
                                    onChangeText={(value) =>
                                      setNewTaskForm((current) =>
                                        current ? { ...current, description: value } : current
                                      )
                                    }
                                  />

                                  <Text style={styles.modalFieldLabel}>Atanan kişi</Text>
                                  <TextInput
                                    placeholder="Atanan kişi"
                                    placeholderTextColor="#94A3B8"
                                    style={styles.modalInput}
                                    value={newTaskForm.assignedTo}
                                    onChangeText={(value) =>
                                      setNewTaskForm((current) =>
                                        current ? { ...current, assignedTo: value } : current
                                      )
                                    }
                                  />

                                  <View style={styles.modalPickerWrap}>
                                    <Text style={styles.modalFieldLabel}>Durum</Text>
                                    <Picker
                                      selectedValue={newTaskForm.status}
                                      onValueChange={(value) =>
                                        setNewTaskForm((current) =>
                                          current ? { ...current, status: value as TaskStatus } : current
                                        )
                                      }>
                                      {taskStatuses.map((status) => (
                                        <Picker.Item key={status} label={status} value={status} />
                                      ))}
                                    </Picker>
                                  </View>

                                  <Text style={styles.modalFieldLabel}>Bitiş tarihi</Text>
                                  <Pressable
                                    onPress={() => setShowNewTaskDatePicker(true)}
                                    style={styles.dateButton}>
                                    <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                                    <Text style={styles.dateButtonText}>
                                      {newTaskForm.dueDate
                                        ? formatEventDate(newTaskForm.dueDate.toISOString())
                                        : 'Tarih seç'}
                                    </Text>
                                  </Pressable>

                                  {showNewTaskDatePicker ? (
                                    <DateTimePicker
                                      mode="datetime"
                                      display="default"
                                      value={newTaskForm.dueDate ?? new Date()}
                                      onChange={handleNewTaskDateChange}
                                    />
                                  ) : null}

                                  <View style={styles.inlineEditActions}>
                                    <Pressable
                                      disabled={isSavingDetailItem}
                                      onPress={handleCancelCreateTask}
                                      style={styles.iconOnlyButton}>
                                      <Ionicons name="close-outline" size={18} color="#475569" />
                                    </Pressable>

                                    <Pressable
                                      disabled={isSavingDetailItem}
                                      onPress={handleCreateTask}
                                      style={[styles.iconOnlyButton, styles.iconOnlySaveButton]}>
                                      {isSavingDetailItem && busyDetailItemId === 'new-task' ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                      ) : (
                                        <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                                      )}
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            ) : null}

                            {eventDetails?.tasks.length ? (
                              eventDetails.tasks.map((task) => (
                                <View key={task.id} style={styles.detailListCard}>
                                  {editingTaskId === task.id && taskEditForm && canCurrentUserEditTask(task) ? (
                                    <View style={styles.inlineEditSection}>
                                      <View style={styles.inlineEditHeader}>
                                        <Text style={styles.detailListTitle}>Görevi Düzenle</Text>
                                      </View>

                                      {isSelectedEventOwner ? (
                                        <>
                                          <Text style={styles.modalFieldLabel}>Görev adı</Text>
                                          <TextInput
                                            placeholder="Görev adı"
                                            placeholderTextColor="#94A3B8"
                                            style={styles.modalInput}
                                            value={taskEditForm.title}
                                            onChangeText={(value) =>
                                              setTaskEditForm((current) =>
                                                current ? { ...current, title: value } : current
                                              )
                                            }
                                          />

                                          <Text style={styles.modalFieldLabel}>Açıklama</Text>
                                          <TextInput
                                            placeholder="Açıklama"
                                            placeholderTextColor="#94A3B8"
                                            style={[styles.modalInput, styles.compactTextArea]}
                                            multiline
                                            value={taskEditForm.description}
                                            onChangeText={(value) =>
                                              setTaskEditForm((current) =>
                                                current ? { ...current, description: value } : current
                                              )
                                            }
                                          />

                                          <Text style={styles.modalFieldLabel}>Atanan kişi</Text>
                                          <TextInput
                                            placeholder="Atanan kişi"
                                            placeholderTextColor="#94A3B8"
                                            style={styles.modalInput}
                                            value={taskEditForm.assignedTo}
                                            onChangeText={(value) =>
                                              setTaskEditForm((current) =>
                                                current ? { ...current, assignedTo: value } : current
                                              )
                                            }
                                          />
                                        </>
                                      ) : (
                                        <>
                                          <Text style={styles.detailListMeta}>Görev: {task.title}</Text>
                                          <Text style={styles.detailListMeta}>Atanan: {task.assigned_to || 'Belirtilmedi'}</Text>
                                        </>
                                      )}

                                      <View style={styles.modalPickerWrap}>
                                        <Text style={styles.modalFieldLabel}>Durum</Text>
                                        <Picker
                                          selectedValue={taskEditForm.status}
                                          onValueChange={(value) =>
                                            setTaskEditForm((current) =>
                                              current ? { ...current, status: value as TaskStatus } : current
                                            )
                                          }>
                                          {taskStatuses.map((status) => (
                                            <Picker.Item key={status} label={status} value={status} />
                                          ))}
                                        </Picker>
                                      </View>

                                      <Text style={styles.modalFieldLabel}>Bitiş tarihi</Text>
                                      <Pressable
                                        onPress={() => setShowTaskDatePicker(true)}
                                        style={styles.dateButton}>
                                        <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                                        <Text style={styles.dateButtonText}>
                                          {taskEditForm.dueDate
                                            ? formatEventDate(taskEditForm.dueDate.toISOString())
                                            : 'Tarih seç'}
                                        </Text>
                                      </Pressable>

                                      {showTaskDatePicker ? (
                                        <DateTimePicker
                                          mode="datetime"
                                          display="default"
                                          value={taskEditForm.dueDate ?? new Date()}
                                          onChange={handleTaskDateChange}
                                        />
                                      ) : null}

                                      <View style={styles.inlineEditActions}>
                                        <Pressable
                                          disabled={isSavingDetailItem}
                                          onPress={handleCancelTaskEdit}
                                          style={styles.iconOnlyButton}>
                                          <Ionicons name="close-outline" size={18} color="#475569" />
                                        </Pressable>

                                        <Pressable
                                          disabled={isSavingDetailItem}
                                          onPress={() => handleSaveTaskEdit(task.id)}
                                          style={[styles.iconOnlyButton, styles.iconOnlySaveButton]}>
                                          {isSavingDetailItem && busyDetailItemId === task.id ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                          ) : (
                                            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                                          )}
                                        </Pressable>
                                      </View>
                                    </View>
                                  ) : (
                                    <>
                                      <View style={styles.detailListHeader}>
                                        <Text style={styles.detailListTitle}>{task.title}</Text>
                                        <View style={styles.detailHeaderRight}>
                                          <Text style={styles.detailTaskStatus}>{task.status}</Text>
                                          {canCurrentUserEditTask(task) ? (
                                            <View style={styles.itemIconRow}>
                                              <Pressable
                                                disabled={busyDetailItemId === task.id}
                                                onPress={() => handleStartTaskEdit(task)}
                                                style={styles.itemIconButton}>
                                                <Ionicons name="create-outline" size={16} color="#1D4ED8" />
                                              </Pressable>
                                              {isSelectedEventOwner ? (
                                                <Pressable
                                                  disabled={busyDetailItemId === task.id}
                                                  onPress={() => confirmDeleteTask(task)}
                                                  style={styles.itemIconButton}>
                                                  {isDeletingDetailItem && busyDetailItemId === task.id ? (
                                                    <ActivityIndicator size="small" color="#B91C1C" />
                                                  ) : (
                                                    <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                                                  )}
                                                </Pressable>
                                              ) : null}
                                            </View>
                                          ) : null}
                                        </View>
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
                                    </>
                                  )}
                                </View>
                              ))
                            ) : (
                              <Text style={styles.detailEmptyText}>Bu etkinlik için görev eklenmemiş.</Text>
                            )}
                          </View>

                          <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                              <Text style={styles.detailSectionTitle}>Katılımcılar</Text>
                              <View style={styles.participantCountBadge}>
                                <Text style={styles.participantCountText}>
                                  {eventDetails?.participantCount ?? 0} Katılımcı
                                </Text>
                              </View>
                              {isSelectedEventOwner ? (
                                <Pressable
                                  disabled={isSavingDetailItem || isCreatingParticipant}
                                  onPress={handleStartCreateParticipant}
                                  style={styles.sectionAddButton}>
                                  <Ionicons name="add-outline" size={18} color="#2563EB" />
                                </Pressable>
                              ) : null}
                            </View>

                            {!isSelectedEventOwner ? (
                              <Text style={styles.detailEmptyText}>
                                Katılımcı isimleri yalnızca etkinlik sahibi tarafından görüntülenebilir.
                              </Text>
                            ) : null}

                            {isSelectedEventOwner && isCreatingParticipant && newParticipantForm ? (
                              <View style={styles.detailListCard}>
                                <View style={styles.inlineEditSection}>
                                  <View style={styles.inlineEditHeader}>
                                    <Text style={styles.detailListTitle}>Yeni Katılımcı</Text>
                                  </View>

                                  <Text style={styles.modalFieldLabel}>E-posta</Text>
                                  <TextInput
                                    placeholder="ornek@email.com"
                                    placeholderTextColor="#94A3B8"
                                    style={styles.modalInput}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    value={newParticipantForm.email}
                                    onChangeText={(value) =>
                                      setNewParticipantForm((current) =>
                                        current ? { ...current, email: value } : current
                                      )
                                    }
                                  />

                                  <View style={styles.modalPickerWrap}>
                                    <Text style={styles.modalFieldLabel}>Davet durumu</Text>
                                    <Picker
                                      selectedValue={newParticipantForm.invitationStatus}
                                      onValueChange={(value) =>
                                        setNewParticipantForm((current) =>
                                          current
                                            ? { ...current, invitationStatus: value as ParticipantStatus }
                                            : current
                                        )
                                      }>
                                      {participantStatuses.map((status) => (
                                        <Picker.Item key={status} label={status} value={status} />
                                      ))}
                                    </Picker>
                                  </View>

                                  <View style={styles.inlineEditActions}>
                                    <Pressable
                                      disabled={isSavingDetailItem}
                                      onPress={handleCancelCreateParticipant}
                                      style={styles.iconOnlyButton}>
                                      <Ionicons name="close-outline" size={18} color="#475569" />
                                    </Pressable>

                                    <Pressable
                                      disabled={isSavingDetailItem}
                                      onPress={handleCreateParticipant}
                                      style={[styles.iconOnlyButton, styles.iconOnlySaveButton]}>
                                      {isSavingDetailItem && busyDetailItemId === 'new-participant' ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                      ) : (
                                        <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                                      )}
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            ) : null}

                            {isSelectedEventOwner && eventDetails?.participants.length ? (
                              eventDetails.participants.map((participant) => (
                                <View key={participant.id} style={styles.detailListCard}>
                                  {editingParticipantId === participant.id && participantEditForm ? (
                                    <View style={styles.inlineEditSection}>
                                      <View style={styles.inlineEditHeader}>
                                        <Text style={styles.detailListTitle}>Katılımcıyı Düzenle</Text>
                                      </View>

                                      <Text style={styles.modalFieldLabel}>E-posta</Text>
                                      <TextInput
                                        placeholder="ornek@email.com"
                                        placeholderTextColor="#94A3B8"
                                        style={styles.modalInput}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={participantEditForm.email}
                                        onChangeText={(value) =>
                                          setParticipantEditForm((current) =>
                                            current ? { ...current, email: value } : current
                                          )
                                        }
                                      />

                                      <View style={styles.modalPickerWrap}>
                                        <Text style={styles.modalFieldLabel}>Davet durumu</Text>
                                        <Picker
                                          selectedValue={participantEditForm.invitationStatus}
                                          onValueChange={(value) =>
                                            setParticipantEditForm((current) =>
                                              current
                                                ? { ...current, invitationStatus: value as ParticipantStatus }
                                                : current
                                            )
                                          }>
                                          {participantStatuses.map((status) => (
                                            <Picker.Item key={status} label={status} value={status} />
                                          ))}
                                        </Picker>
                                      </View>

                                      <View style={styles.inlineEditActions}>
                                        <Pressable
                                          disabled={isSavingDetailItem}
                                          onPress={handleCancelParticipantEdit}
                                          style={styles.iconOnlyButton}>
                                          <Ionicons name="close-outline" size={18} color="#475569" />
                                        </Pressable>

                                        <Pressable
                                          disabled={isSavingDetailItem}
                                          onPress={() => handleSaveParticipantEdit(participant.id)}
                                          style={[styles.iconOnlyButton, styles.iconOnlySaveButton]}>
                                          {isSavingDetailItem && busyDetailItemId === participant.id ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                          ) : (
                                            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                                          )}
                                        </Pressable>
                                      </View>
                                    </View>
                                  ) : (
                                    <>
                                      <View style={styles.detailListHeader}>
                                        <Text style={styles.detailListTitle}>{participant.email}</Text>
                                        <View style={styles.itemIconRow}>
                                          <Pressable
                                            disabled={busyDetailItemId === participant.id}
                                            onPress={() => handleStartParticipantEdit(participant)}
                                            style={styles.itemIconButton}>
                                            <Ionicons name="create-outline" size={16} color="#1D4ED8" />
                                          </Pressable>
                                          <Pressable
                                            disabled={busyDetailItemId === participant.id}
                                            onPress={() => confirmDeleteParticipant(participant)}
                                            style={styles.itemIconButton}>
                                            {isDeletingDetailItem && busyDetailItemId === participant.id ? (
                                              <ActivityIndicator size="small" color="#B91C1C" />
                                            ) : (
                                              <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                                            )}
                                          </Pressable>
                                        </View>
                                      </View>
                                      <Text style={styles.detailListMeta}>
                                        Davet durumu: {participant.invitation_status}
                                      </Text>
                                    </>
                                  )}
                                </View>
                              ))
                            ) : isSelectedEventOwner ? (
                              <Text style={styles.detailEmptyText}>Bu etkinlik için katılımcı eklenmemiş.</Text>
                            ) : null}
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
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 6px 12px rgba(15, 23, 42, 0.06)' }
      : {
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: {
            width: 0,
            height: 6,
          },
          elevation: 2,
        }),
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
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  detailSectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionAddButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  participantCountText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
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
  detailHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  itemIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemIconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEditSection: {
    gap: 10,
  },
  inlineEditHeader: {
    marginBottom: 2,
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  iconOnlyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnlySaveButton: {
    backgroundColor: '#2563EB',
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
  compactTextArea: {
    minHeight: 88,
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
