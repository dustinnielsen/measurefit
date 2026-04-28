import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { WORKOUT_EMOJIS, WORKOUT_LABELS, WorkoutType } from '../../types/enums';
import { workoutColor } from '../../theme';
import { Radius, Spacing, Typography } from '../../theme';

interface WorkoutTypeBadgeProps {
  type: WorkoutType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: ViewStyle;
}

export function WorkoutTypeBadge({ type, size = 'md', showLabel = false, style }: WorkoutTypeBadgeProps) {
  const color = workoutColor(type);
  const dim   = size === 'lg' ? 56 : size === 'md' ? 44 : 32;
  const emojiSize = size === 'lg' ? 28 : size === 'md' ? 22 : 16;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.circle, { width: dim, height: dim, backgroundColor: color + '20', borderRadius: dim / 2 }]}>
        <Text style={{ fontSize: emojiSize }}>{WORKOUT_EMOJIS[type]}</Text>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>{WORKOUT_LABELS[type]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },
  circle:  { alignItems: 'center', justifyContent: 'center' },
  label:   { ...Typography.caption1, fontWeight: '600' },
});
