import { StyleSheet } from 'react-native';
import { WorkoutType } from '../types/enums';

// MARK: - Brand palette

export const Colors = {
  // Brand
  accent:      '#FF5C2E',
  accentLight: '#FF5C2E22',

  // Workout types
  easy:        '#34C759',
  long:        '#3478F6',
  tempo:       '#FF9500',
  intervals:   '#FF3B30',
  strides:     '#5AC8FA',
  strength:    '#AF52DE',
  mobility:    '#32D74B',
  rest:        '#8E8E93',

  // Surfaces (light)
  bg:          '#F2F2F7',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F2F2F7',
  tertiary:    '#E5E5EA',

  // Text
  textPrimary:   '#1C1C1E',
  textSecondary: '#6C6C70',
  textTertiary:  '#AEAEB2',
  textInverted:  '#FFFFFF',

  // Status
  success: '#34C759',
  warning: '#FF9500',
  danger:  '#FF3B30',

  // Misc
  border:    '#C6C6C8',
  separator: '#E5E5EA',
  overlay:   'rgba(0,0,0,0.4)',
} as const;

export function workoutColor(type: WorkoutType): string {
  const map: Record<WorkoutType, string> = {
    [WorkoutType.Easy]:      Colors.easy,
    [WorkoutType.Long]:      Colors.long,
    [WorkoutType.Tempo]:     Colors.tempo,
    [WorkoutType.Intervals]: Colors.intervals,
    [WorkoutType.Strides]:   Colors.strides,
    [WorkoutType.Strength]:  Colors.strength,
    [WorkoutType.Mobility]:  Colors.mobility,
    [WorkoutType.Rest]:      Colors.rest,
  };
  return map[type];
}

// MARK: - Typography

export const Typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.4 },
  title1:     { fontSize: 28, fontWeight: '700' as const },
  title2:     { fontSize: 22, fontWeight: '700' as const },
  title3:     { fontSize: 20, fontWeight: '600' as const },
  headline:   { fontSize: 17, fontWeight: '600' as const },
  body:       { fontSize: 17, fontWeight: '400' as const },
  callout:    { fontSize: 16, fontWeight: '400' as const },
  subhead:    { fontSize: 15, fontWeight: '400' as const },
  footnote:   { fontSize: 13, fontWeight: '400' as const },
  caption1:   { fontSize: 12, fontWeight: '400' as const },
  caption2:   { fontSize: 11, fontWeight: '400' as const },
  label:      { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
} as const;

// MARK: - Spacing

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 48,
} as const;

// MARK: - Border radii

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,
} as const;

// MARK: - Common shared styles

export const CommonStyles = StyleSheet.create({
  flex1:       { flex: 1 },
  screenBg:    { flex: 1, backgroundColor: Colors.bg },
  row:         { flexDirection: 'row', alignItems: 'center' },
  rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center:      { alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },

  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  shadowStrong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
});
