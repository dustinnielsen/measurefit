import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme';

interface PillProps {
  text: string;
  color?: string;
  style?: ViewStyle;
}

export function Pill({ text, color = Colors.accent, style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '20' }, style]}>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.caption2,
    fontWeight: '700',
  },
});
