import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

type AuthMode = 'login' | 'signup';

type AuthScreenProps = {
  mode?: AuthMode;
};

export function AuthScreen({ mode: initialMode = 'login' }: AuthScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const isSignup = mode === 'signup';

  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || (isSignup && !fullName.trim())) {
      Alert.alert('Eksik alan', 'Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        Alert.alert('E-postanızı kontrol edin', 'Hesabınız oluşturuldu. Devam etmek için e-postanızı onaylayın.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir şeyler ters gitti.';
      Alert.alert('Kimlik doğrulama başarısız', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Çıkış başarısız', error.message);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFullName('');
    setEmail('');
    setPassword('');
    setIsPasswordVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* App Icon */}
          <View style={styles.iconWrapper}>
            <LinearGradient
              colors={['#5B6CF6', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}>
              <Ionicons name="calendar-outline" size={40} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* App Title */}
          <Text style={styles.appTitle}>Etkinlik Yonetim</Text>

          {/* Card */}
          <View style={styles.card}>

            {session ? (
              <View style={styles.sessionBox}>
                <Ionicons name="checkmark-circle" size={52} color="#5B6CF6" />
                <Text style={styles.sessionTitle}>Giriş yapıldı</Text>
                <Text style={styles.sessionEmail}>{session.user.email}</Text>
                <Pressable onPress={handleSignOut} style={styles.signOutButton}>
                  <Text style={styles.signOutText}>Çıkış Yap</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Tab Toggle */}
                <View style={styles.tabRow}>
                  <Pressable
                    onPress={() => switchMode('login')}
                    style={[styles.tab, !isSignup && styles.tabActive]}>
                    {!isSignup ? (
                      <LinearGradient
                        colors={['#5B6CF6', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tabGradient}>
                        <Text style={styles.tabTextActive}>Giriş Yap</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.tabTextInactive}>Giriş Yap</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => switchMode('signup')}
                    style={[styles.tab, isSignup && styles.tabActive]}>
                    {isSignup ? (
                      <LinearGradient
                        colors={['#5B6CF6', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tabGradient}>
                        <Text style={styles.tabTextActive}>Kayıt Ol</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.tabTextInactive}>Kayıt Ol</Text>
                    )}
                  </Pressable>
                </View>

                {/* Full Name (signup only) */}
                {isSignup && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ad Soyad</Text>
                    <View style={styles.inputShell}>
                      <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        autoCapitalize="words"
                        onChangeText={setFullName}
                        placeholder="Ad Soyad"
                        placeholderTextColor="#9CA3AF"
                        style={styles.inputField}
                        value={fullName}
                      />
                    </View>
                  </View>
                )}

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-posta</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      onChangeText={setEmail}
                      placeholder="ornek@email.com"
                      placeholderTextColor="#9CA3AF"
                      style={styles.inputField}
                      value={email}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Şifre</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      autoCapitalize="none"
                      autoComplete={isSignup ? 'new-password' : 'password'}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!isPasswordVisible}
                      style={styles.inputField}
                      value={password}
                    />
                    <Pressable onPress={() => setIsPasswordVisible((v) => !v)} style={styles.eyeButton}>
                      <Ionicons
                        name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Forgot Password (login only) */}
                {!isSignup && (
                  <Pressable
                    hitSlop={10}
                    onPress={() => router.push('/forgot-password')}
                    style={styles.forgotRow}>
                    <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                  </Pressable>
                )}

                {/* Submit Button */}
                <Pressable disabled={isSubmitting} onPress={handleSubmit} style={styles.submitWrapper}>
                  <LinearGradient
                    colors={['#5B6CF6', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>
                        {isSignup ? 'Kayıt Ol' : 'Giriş Yap'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF0FB',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
  },

  // App Icon
  iconWrapper: {
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 32,
    letterSpacing: -0.5,
  },

  // Card
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

  // Tab Toggle
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 28,
    gap: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 13,
    overflow: 'hidden',
  },
  tabActive: {
    // gradient handles styling
  },
  tabGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 13,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  tabTextInactive: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 13,
  },

  // Input
  inputGroup: {
    marginBottom: 18,
  },
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
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F172A',
  },
  eyeButton: {
    padding: 4,
  },

  // Forgot
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -6,
  },
  forgotText: {
    color: '#5B6CF6',
    fontSize: 14,
    fontWeight: '600',
  },

  // Submit
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
    letterSpacing: 0.3,
  },

  // Session
  sessionBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  sessionEmail: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 8,
  },
  signOutButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#5B6CF6',
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  signOutText: {
    color: '#5B6CF6',
    fontSize: 15,
    fontWeight: '700',
  },
});
