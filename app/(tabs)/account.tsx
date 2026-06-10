import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

type UserInfo = {
  email: string;
  fullName: string;
  createdAt: string;
};

export default function AccountScreen() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Name edit
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setUserInfo(null);
        return;
      }
      const user = data.user;
      const metaName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.trim()
          : '';
      setUserInfo({
        email: user.email ?? '',
        fullName: metaName,
        createdAt: user.created_at ?? '',
      });
      setEditedName(metaName);
    } catch {
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUser();
    }, [loadUser])
  );

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Oturumunuzu kapatmak istediğinize emin misiniz?');
      if (!confirmed) return;
      await supabase.auth.signOut();
    } else {
      Alert.alert('Çıkış Yap', 'Oturumunuzu kapatmak istediğinize emin misiniz?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'Ad soyad boş bırakılamaz.');
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      });
      if (error) throw error;
      setUserInfo((prev) => (prev ? { ...prev, fullName: trimmed } : prev));
      setIsEditingName(false);
      Alert.alert('Başarılı', 'Adınız güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ad güncellenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Hata', 'Yeni şifre boş bırakılamaz.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      Alert.alert('Başarılı', 'Şifreniz güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Şifre güncellenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5B6CF6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#64748B" />
          <Text style={styles.errorText}>Kullanıcı bilgileri yüklenemedi.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Profile Header */}
          <LinearGradient
            colors={['#5B6CF6', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(userInfo.fullName || userInfo.email)[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {userInfo.fullName || 'İsimsiz Kullanıcı'}
            </Text>
            <Text style={styles.profileEmail}>{userInfo.email}</Text>
          </LinearGradient>

          {/* Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hesap Bilgileri</Text>

            {/* Full Name */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="person-outline" size={20} color="#5B6CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ad Soyad</Text>
                {isEditingName ? (
                  <View style={styles.editNameRow}>
                    <TextInput
                      style={styles.editNameInput}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Ad Soyad"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                    />
                    <Pressable
                      style={styles.editNameSave}
                      onPress={handleSaveName}
                      disabled={isSavingName}>
                      {isSavingName ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.editNameCancel}
                      onPress={() => {
                        setIsEditingName(false);
                        setEditedName(userInfo.fullName);
                      }}>
                      <Ionicons name="close" size={18} color="#64748B" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditedName(userInfo.fullName);
                      setIsEditingName(true);
                    }}
                    style={styles.editableRow}>
                    <Text style={styles.infoValue}>
                      {userInfo.fullName || 'Belirtilmedi'}
                    </Text>
                    <Ionicons name="pencil-outline" size={16} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Email */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="mail-outline" size={20} color="#5B6CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{userInfo.email}</Text>
              </View>
            </View>

            {/* Created Date */}
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="calendar-outline" size={20} color="#5B6CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Kayıt Tarihi</Text>
                <Text style={styles.infoValue}>{formatDate(userInfo.createdAt)}</Text>
              </View>
            </View>
          </View>

          {/* Password Change Card */}
          <View style={styles.card}>
            <Pressable
              style={styles.cardHeaderRow}
              onPress={() => {
                setShowPasswordForm((v) => !v);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="lock-closed-outline" size={20} color="#5B6CF6" />
                <Text style={styles.cardTitle}>Şifre Değiştir</Text>
              </View>
              <Ionicons
                name={showPasswordForm ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#94A3B8"
              />
            </Pressable>

            {showPasswordForm && (
              <View style={styles.passwordForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Yeni Şifre</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="En az 6 karakter"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!isPasswordVisible}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setIsPasswordVisible((v) => !v)}>
                      <Ionicons
                        name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Yeni Şifre (Tekrar)</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Şifreyi tekrar girin"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!isPasswordVisible}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <Pressable
                  style={styles.passwordButton}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}>
                  <LinearGradient
                    colors={isChangingPassword ? ['#94A3B8', '#94A3B8'] : ['#5B6CF6', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.passwordButtonGradient}>
                    {isChangingPassword ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.passwordButtonText}>Şifreyi Güncelle</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            )}
          </View>

          {/* Sign Out */}
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </Pressable>

          <Text style={styles.versionText}>Etkinlik Yönetim v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },

  // Profile Header
  profileHeader: {
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 14,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Edit name
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editNameInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  editNameSave: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5B6CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNameCancel: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Password form
  passwordForm: {
    marginTop: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  passwordButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
