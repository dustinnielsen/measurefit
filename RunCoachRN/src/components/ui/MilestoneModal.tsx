import React, { useEffect, useRef } from 'react';
import {
  Animated, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { Milestone } from '../../types/models';

interface Props {
  milestone: Milestone | null;
  onDismiss: () => void;
}

export function MilestoneModal({ milestone, onDismiss }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!milestone) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [milestone]);

  if (!milestone) return null;

  return (
    <Modal transparent animationType="none" visible={!!milestone} onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.glowRing}>
            <Text style={styles.emoji}>{milestone.emoji}</Text>
          </View>
          <Text style={[Typography.label, { color: Colors.accent, marginBottom: 4 }]}>
            MILESTONE UNLOCKED
          </Text>
          <Text style={[Typography.title2, { color: Colors.textPrimary, textAlign: 'center' }]}>
            {milestone.title}
          </Text>
          <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {milestone.description}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={[Typography.subhead, { color: Colors.textInverted, fontWeight: '700' }]}>
              Keep Going
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius['2xl'],
    padding: Spacing['3xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  glowRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.accent + '40',
  },
  emoji: { fontSize: 48 },
  btn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
  },
});
