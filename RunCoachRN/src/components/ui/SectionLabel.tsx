import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '../../theme';

interface SectionLabelProps {
  title: string;
  color?: string;
}

export function SectionLabel({ title, color = Colors.textSecondary }: SectionLabelProps) {
  return (
    <Text style={[styles.label, { color }]}>{title.toUpperCase()}</Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
});
