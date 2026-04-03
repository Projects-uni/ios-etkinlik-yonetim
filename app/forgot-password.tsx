import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { getResetPasswordRedirectUrl } from '@/lib/get-reset-password-redirect-url';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetPasswordUrl = getResetPasswordRedirectUrl();

  const handleSendLink = async () => {
    if (!email.trim()) {
      Alert.alert('E-posta gerekli', 'Lütfen hesabınıza ait e-posta adresini girin.');
      return;
    }

    if (!resetPasswordUrl) {
      Alert.alert(
        'Ayar gerekli',
        'Tarayicida acilacak sifre sifirlama adresini EXPO_PUBLIC_RESET_PASSWORD_URL olarak tanimlayin.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetPasswordUrl,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Bağlantı gönderildi',
        'Kayıtlı bir hesap varsa şifre sıfırlama e-postası birkaç dakika içinde gelir. Spam/gereksiz klasörüne de bakın. Hiç gelmezse bu adresle kayıtlı kullanıcı olmayabilir veya e-posta gecikmiş olabilir.',
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir şeyler ters gitti.';
      Alert.alert('Gönderim başarısız', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
            <Text style={styles.backText}>Geri</Text>
          </Pressable>

          <View style={styles.iconWrapper}>
            <LinearGradient
              colors={['#5B6CF6', '#A855F7']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.iconGradient}>
              <Ionicons name="mail-open-outline" size={34} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Şifreyi Sıfırla</Text>
          <Text style={styles.subtitle}>
            E-posta adresinizi girin. Size şifrenizi yenilemek için bir bağlantı gönderelim.
          </Text>

          <View style={styles.card}>
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

            <Pressable disabled={isSubmitting} onPress={handleSendLink} style={styles.submitWrapper}>
              <LinearGradient
                colors={['#5B6CF6', '#A855F7']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={styles.submitGradient}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Sıfırlama Bağlantısı Gönder</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  backText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  iconWrapper: {
    alignSelf: 'center',
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
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    color: '#64748B',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
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
  submitWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 22,
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
    fontSize: 16,
    fontWeight: '800',
  },
});
