import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const eventCategories = ['Konser', 'Konferans', 'Spor', 'Festival', 'Atölye', 'Diğer'] as const;
const eventStatuses = ['Taslak', 'Planlanıyor', 'Yayında', 'Tamamlandı', 'İptal'] as const;
const taskStatuses = ['Beklemede', 'Devam Ediyor', 'Tamamlandı'] as const;

type EventCategory = (typeof eventCategories)[number];
type EventStatus = (typeof eventStatuses)[number];
type TaskStatus = (typeof taskStatuses)[number];

type TaskDraft = {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  dueDate: Date | null;
};

function formatDate(date: Date | null) {
  if (!date) {
    return 'Tarih seç';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function createTaskDraft(): TaskDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    description: '',
    assignedTo: '',
    status: 'Beklemede',
    dueDate: null,
  };
}

export default function EventCreationScreen() {
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 390, 0.9), 1.08);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<EventCategory>('Konser');
  const [status, setStatus] = useState<EventStatus>('Taslak');
  const [budget, setBudget] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [tasks, setTasks] = useState<TaskDraft[]>([createTaskDraft()]);
  const [taskDatePickerId, setTaskDatePickerId] = useState<string | null>(null);
  const [participantEmail, setParticipantEmail] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const spacing = {
    screen: Math.round(20 * scale),
    card: Math.round(22 * scale),
    inputVertical: Math.round(14 * scale),
    inputHorizontal: Math.round(16 * scale),
    radius: Math.round(22 * scale),
  };

  const addTask = () => {
    setTasks((current) => [...current, createTaskDraft()]);
  };

  const updateTask = (taskId: string, field: keyof TaskDraft, value: string | Date | null) => {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, [field]: value } : task))
    );
  };

  const removeTask = (taskId: string) => {
    setTasks((current) => {
      if (current.length === 1) {
        return [createTaskDraft()];
      }

      return current.filter((task) => task.id !== taskId);
    });

    setTaskDatePickerId((current) => (current === taskId ? null : current));
  };

  const addParticipant = () => {
    const normalized = participantEmail.trim().toLowerCase();

    if (!normalized) {
      Alert.alert('Eksik bilgi', 'Önce bir e-posta adresi girin.');
      return;
    }

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!isEmailValid) {
      Alert.alert('Geçersiz e-posta', 'Katılımcı için geçerli bir e-posta adresi girin.');
      return;
    }

    if (participants.includes(normalized)) {
      Alert.alert('Tekrarlı kayıt', 'Bu katılımcı zaten davet listesinde.');
      return;
    }

    setParticipants((current) => [...current, normalized]);
    setParticipantEmail('');
  };

  const removeParticipant = (email: string) => {
    setParticipants((current) => current.filter((item) => item !== email));
  };

  const handleEventDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'web') {
      setShowEventDatePicker(false);
    }
    if (selectedDate) {
      setEventDate(selectedDate);
    }
  };

  const handleTaskDateChange =
    (taskId: string) => (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS !== 'web') {
        setTaskDatePickerId(null);
      }
      if (selectedDate) {
        updateTask(taskId, 'dueDate', selectedDate);
      }
    };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setCategory('Konser');
    setStatus('Taslak');
    setBudget('');
    setEventDate(new Date());
    setShowEventDatePicker(false);
    setTasks([createTaskDraft()]);
    setTaskDatePickerId(null);
    setParticipantEmail('');
    setParticipants([]);
  };

  const handleCreateEvent = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert('Eksik bilgi', 'Etkinlik adı, açıklama ve konum alanları zorunludur.');
      return;
    }

    const validTasks = tasks
      .map((task) => ({
        ...task,
        title: task.title.trim(),
        description: task.description.trim(),
        assignedTo: task.assignedTo.trim(),
      }))
      .filter((task) => task.title.length > 0);

    const hasInvalidTask = validTasks.some((task) => !task.description || !task.assignedTo || !task.dueDate);
    if (hasInvalidTask) {
      Alert.alert(
        'Eksik görev bilgisi',
        'Eklediğiniz her görev için açıklama, bitiş tarihi ve atanan kişi bilgisi girin.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('Etkinlik oluşturmak için giriş yapmanız gerekiyor.');
      }

      const parsedBudget =
        budget.trim().length > 0
          ? Number.parseFloat(budget.replace(',', '.'))
          : null;

      if (parsedBudget !== null && Number.isNaN(parsedBudget)) {
        throw new Error('Bütçe alanına sayısal bir değer girin.');
      }

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          organizer_id: user.id,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          category,
          status,
          event_date: eventDate.toISOString(),
          budget: parsedBudget,
        })
        .select('id')
        .single();

      if (eventError) {
        throw eventError;
      }

      if (validTasks.length > 0) {
        const { error: tasksError } = await supabase.from('tasks').insert(
          validTasks.map((task) => ({
            event_id: event.id,
            title: task.title,
            description: task.description,
            due_date: task.dueDate?.toISOString(),
            assigned_to: task.assignedTo,
            status: task.status,
          }))
        );

        if (tasksError) {
          throw tasksError;
        }
      }

      if (participants.length > 0) {
        const { error: participantsError } = await supabase.from('event_participants').insert(
          participants.map((email) => ({
            event_id: event.id,
            email,
            invited_by: user.id,
          }))
        );

        if (participantsError) {
          throw participantsError;
        }
      }

      resetForm();
      Alert.alert('Başarılı', 'Etkinlik, görevler ve katılımcı davetleri kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu.';
      Alert.alert('Kayıt başarısız', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.screen }]}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#0F172A', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { padding: spacing.card, borderRadius: spacing.radius + 4 }]}>
          <Text style={[styles.eyebrow, { fontSize: Math.round(13 * scale) }]}>Organizatör Paneli</Text>
          <Text style={[styles.heroTitle, { fontSize: Math.round(29 * scale) }]}>Yeni Etkinlik Oluştur</Text>
          <Text style={[styles.heroText, { fontSize: Math.round(15 * scale), lineHeight: Math.round(23 * scale) }]}>
            Etkinlik bilgilerini ekleyin, görevleri planlayın ve katılımcıları tek akışta davet edin.
          </Text>
        </LinearGradient>

        <View style={[styles.sectionCard, { padding: spacing.card, borderRadius: spacing.radius }]}>
          <Text style={[styles.sectionTitle, { fontSize: Math.round(21 * scale) }]}>Etkinlik Bilgileri</Text>
          <Text style={styles.sectionText}>Temel bilgileri girin. Oluşturan kullanıcı Supabase Auth üzerinden alınır.</Text>

          <TextInput
            placeholder="Etkinlik adı"
            placeholderTextColor="#94A3B8"
            style={[styles.input, { paddingHorizontal: spacing.inputHorizontal, paddingVertical: spacing.inputVertical }]}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            placeholder="Açıklama"
            placeholderTextColor="#94A3B8"
            style={[
              styles.input,
              styles.textArea,
              { paddingHorizontal: spacing.inputHorizontal, paddingVertical: spacing.inputVertical },
            ]}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <TextInput
            placeholder="Konum"
            placeholderTextColor="#94A3B8"
            style={[styles.input, { paddingHorizontal: spacing.inputHorizontal, paddingVertical: spacing.inputVertical }]}
            value={location}
            onChangeText={setLocation}
          />

          <View style={styles.splitRow}>
            <View style={styles.halfColumn}>
              <Text style={styles.fieldLabel}>Kategori</Text>
              <View style={styles.pickerShell}>
                <Picker selectedValue={category} onValueChange={(value) => setCategory(value as EventCategory)}>
                  {eventCategories.map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.halfColumn}>
              <Text style={styles.fieldLabel}>Durum</Text>
              <View style={styles.pickerShell}>
                <Picker selectedValue={status} onValueChange={(value) => setStatus(value as EventStatus)}>
                  {eventStatuses.map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <Pressable style={styles.dateButton} onPress={() => setShowEventDatePicker((current) => !current)}>
            <View>
              <Text style={styles.fieldLabel}>Etkinlik Tarihi</Text>
              <Text style={styles.dateText}>{formatDate(eventDate)}</Text>
            </View>
            <Ionicons name="calendar-outline" size={22} color="#2563EB" />
          </Pressable>

          {showEventDatePicker ? (
            <DateTimePicker
              mode="datetime"
              value={eventDate}
              onChange={handleEventDateChange}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
            />
          ) : null}

          <TextInput
            placeholder="Bütçe (isteğe bağlı)"
            placeholderTextColor="#94A3B8"
            keyboardType="decimal-pad"
            style={[styles.input, { paddingHorizontal: spacing.inputHorizontal, paddingVertical: spacing.inputVertical }]}
            value={budget}
            onChangeText={setBudget}
          />
        </View>

        <View style={[styles.sectionCard, { padding: spacing.card, borderRadius: spacing.radius }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { fontSize: Math.round(21 * scale) }]}>Görev Yönetimi</Text>
              <Text style={styles.sectionText}>Her görev için isim, açıklama, bitiş tarihi, atanan kişi ve durum girin.</Text>
            </View>
            <Pressable style={styles.addButton} onPress={addTask}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Görev Ekle</Text>
            </Pressable>
          </View>

          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.taskSeparator} />}
            renderItem={({ item, index }) => (
              <View style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle}>Görev {index + 1}</Text>
                  <Pressable onPress={() => removeTask(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </Pressable>
                </View>

                <TextInput
                  placeholder="Görev adı"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  value={item.title}
                  onChangeText={(value) => updateTask(item.id, 'title', value)}
                />

                <TextInput
                  placeholder="Görev açıklaması"
                  placeholderTextColor="#94A3B8"
                  style={[styles.input, styles.textArea]}
                  multiline
                  value={item.description}
                  onChangeText={(value) => updateTask(item.id, 'description', value)}
                />

                <TextInput
                  placeholder="Atanan kişi"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  value={item.assignedTo}
                  onChangeText={(value) => updateTask(item.id, 'assignedTo', value)}
                />

                <View style={styles.chipWrap}>
                  {taskStatuses.map((taskStatus) => {
                    const selected = taskStatus === item.status;
                    return (
                      <Pressable
                        key={taskStatus}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => updateTask(item.id, 'status', taskStatus)}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{taskStatus}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.dateButton}
                  onPress={() =>
                    setTaskDatePickerId((current) => (current === item.id ? null : item.id))
                  }>
                  <View>
                    <Text style={styles.fieldLabel}>Bitiş Tarihi</Text>
                    <Text style={styles.dateText}>{formatDate(item.dueDate)}</Text>
                  </View>
                  <Ionicons name="time-outline" size={22} color="#2563EB" />
                </Pressable>

                {taskDatePickerId === item.id ? (
                  <DateTimePicker
                    mode="datetime"
                    value={item.dueDate ?? eventDate}
                    onChange={handleTaskDateChange(item.id)}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  />
                ) : null}
              </View>
            )}
          />
        </View>

        <View style={[styles.sectionCard, { padding: spacing.card, borderRadius: spacing.radius }]}>
          <Text style={[styles.sectionTitle, { fontSize: Math.round(21 * scale) }]}>Katılımcı Yönetimi</Text>
          <Text style={styles.sectionText}>E-posta ile davet edilecek katılımcıları listeye ekleyin.</Text>

          <View style={styles.participantRow}>
            <TextInput
              placeholder="katilimci@mail.com"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.participantInput]}
              value={participantEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setParticipantEmail}
            />
            <Pressable style={styles.addInlineButton} onPress={addParticipant}>
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-open-outline" size={26} color="#64748B" />
              <Text style={styles.emptyStateText}>Henüz davet e-postası eklenmedi.</Text>
            </View>
          ) : (
            <View style={styles.participantList}>
              {participants.map((email) => (
                <View key={email} style={styles.participantChip}>
                  <Text style={styles.participantChipText}>{email}</Text>
                  <Pressable onPress={() => removeParticipant(email)}>
                    <Ionicons name="close" size={16} color="#475569" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.submitButton} onPress={handleCreateEvent} disabled={isSubmitting}>
          <LinearGradient
            colors={isSubmitting ? ['#94A3B8', '#94A3B8'] : ['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}>
            <Text style={styles.submitText}>{isSubmitting ? 'Kaydediliyor...' : 'Etkinliği Kaydet'}</Text>
          </LinearGradient>
        </Pressable>
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
    paddingTop: 12,
    paddingBottom: 34,
    gap: 18,
  },
  heroCard: {
    overflow: 'hidden',
  },
  eyebrow: {
    color: '#BFDBFE',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 10,
  },
  heroText: {
    color: '#DBEAFE',
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    color: '#0F172A',
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 14,
  },
  halfColumn: {
    flex: 1,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  pickerShell: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA',
  },
  chipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#1D4ED8',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskSeparator: {
    height: 12,
  },
  taskCard: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantInput: {
    flex: 1,
    marginBottom: 0,
  },
  addInlineButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  participantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  participantChipText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  submitGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
