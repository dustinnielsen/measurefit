import React from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity,
  type TouchableOpacityProps, type ViewStyle,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  color?: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function PrimaryButton({
  label, color = Colors.accent, loading, size = 'lg', style, disabled, ...rest
}: ButtonProps) {
  const h = size === 'lg' ? 54 : size === 'md' ? 44 : 36;
  return (
    <TouchableOpacity
      style={[styles.base, { backgroundColor: color, height: h, opacity: disabled ? 0.5 : 1 }, style]}
      disabled={disabled || loading}
      activeOpacity={0.85}
      {...rest}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.primaryLabel}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, color = Colors.accent, size = 'lg', style, ...rest }: ButtonProps) {
  const h = size === 'lg' ? 54 : size === 'md' ? 44 : 36;
  return (
    <TouchableOpacity
      style={[styles.base, styles.secondary, { borderColor: color, height: h }, style]}
      activeOpacity={0.7}
      {...rest}
    >
      <Text style={[styles.secondaryLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, color = Colors.textSecondary, style, ...rest }: ButtonProps) {
  return (
    <TouchableOpacity style={[styles.ghost, style]} activeOpacity={0.6} {...rest}>
      <Text style={[styles.ghostLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  primaryLabel: {
    ...Typography.headline,
    color: Colors.textInverted,
  },
  secondaryLabel: {
    ...Typography.headline,
  },
  ghostLabel: {
    ...Typography.subhead,
  },
});
