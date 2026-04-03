import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsCheckingSession(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async () => {
    if (!session) {
      Alert.alert('Gecersiz oturum', 'Bu sifre sifirlama baglantisi gecersiz veya suresi dolmus.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Hata', 'Lütfen yeni şifrenizi girin.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      await supabase.auth.signOut();
      Alert.alert('Başarılı', 'Parola başarılı şekilde değiştirildi.', [
        { text: 'Tamam', onPress: () => router.replace('/') },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.content}>

          <View style={styles.iconWrapper}>
            <LinearGradient
              colors={['#5B6CF6', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}>
              <Ionicons name="lock-open-outline" size={36} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Yeni Şifre</Text>
          <Text style={styles.subtitle}>
            Hesabınız için güçlü bir şifre belirleyin.
          </Text>

          <View style={styles.card}>
            {isCheckingSession ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#5B6CF6" />
                <Text style={styles.stateText}>Sifirlama oturumu kontrol ediliyor...</Text>
              </View>
            ) : !session ? (
              <View style={styles.stateBox}>
                <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
                <Text style={styles.stateTitle}>Baglanti gecersiz</Text>
                <Text style={styles.stateText}>
                  Bu sifre sifirlama baglantisi gecersiz, kullanilmis veya suresi dolmus olabilir.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Yeni Şifre</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      autoCapitalize="none"
                      onChangeText={setPassword}
                      placeholder="En az 6 karakter"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!isVisible}
                      style={styles.inputField}
                      value={password}
                    />
                    <Pressable onPress={() => setIsVisible((v) => !v)}>
                      <Ionicons
                        name={isVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Şifre Tekrar</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      autoCapitalize="none"
                      onChangeText={setConfirmPassword}
                      placeholder="Şifreyi tekrar girin"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!isVisible}
                      style={styles.inputField}
                      value={confirmPassword}
                    />
                  </View>
                </View>

                <Pressable disabled={isSubmitting} onPress={handleReset} style={styles.submitWrapper}>
                  <LinearGradient
                    colors={['#5B6CF6', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Şifreyi Güncelle</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EAF0FB' },
  flex: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconWrapper: {
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  inputGroup: { marginBottom: 18 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  inputField: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F172A',
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
  submitWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
