import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors, CommonStyles, Radius, Spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, style, padding = Spacing.lg }: CardProps) {
  return (
    <View style={[styles.card, CommonStyles.shadow, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
});
