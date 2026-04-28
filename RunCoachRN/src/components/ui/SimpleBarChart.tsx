import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../theme';

export interface BarData {
  label: string;
  value: number;
  target?: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarData[];
  height?: number;
  showTarget?: boolean;
}

export function SimpleBarChart({ data, height = 140, showTarget = true }: SimpleBarChartProps) {
  const maxVal = Math.max(...data.map(d => Math.max(d.value, d.target ?? 0)), 1);

  return (
    <View style={{ height: height + 28 }}>
      {/* Bars */}
      <View style={[styles.chartArea, { height }]}>
        {data.map((bar, i) => {
          const fillH  = Math.max(2, (bar.value  / maxVal) * height);
          const targH  = bar.target ? (bar.target / maxVal) * height : 0;
          const color  = bar.color ?? Colors.accent;
          const filled = bar.value >= (bar.target ?? 0) * 0.8;

          return (
            <View key={i} style={styles.barColumn}>
              <View style={[styles.barTrack, { height }]}>
                {/* Target dashed line */}
                {showTarget && bar.target != null && bar.target > 0 && (
                  <View
                    style={[styles.targetLine, { bottom: targH - 1 }]}
                  />
                )}
                {/* Fill bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: fillH,
                      backgroundColor: filled ? color : Colors.tertiary,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={styles.labelsRow}>
        {data.map((bar, i) => (
          <Text key={i} style={styles.axisLabel} numberOfLines={1}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.textTertiary,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  axisLabel: {
    flex: 1,
    ...Typography.caption2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
