import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert('Sign in failed', e.message || 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>WF</Text>
          </View>
          <Text style={styles.appName}>WindowFit</Text>
          <Text style={styles.tagline}>Professional Window Measuring</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Powered by WindowFit · Nielsen Shades & Shutters
        </Text>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 14,
  },
  form: {
    gap: 8,
  },
  label: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1C2128',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0A84FF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 48,
  },
});