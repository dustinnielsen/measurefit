import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Circle, Polyline, Line } from 'react-native-svg';

interface Props {
  name: string;
  color: string;
  focused: boolean;
  size?: number;
}

export function TabBarIcon({ name, color, size = 22 }: Props) {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none' };
  const stroke = { stroke: color, strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'Home':
      return (
        <Svg {...props}>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...stroke} />
          <Polyline points="9 22 9 12 15 12 15 22" {...stroke} />
        </Svg>
      );
    case 'Scan':
      return (
        <Svg {...props}>
          <Path d="M3 7V5a2 2 0 0 1 2-2h2" {...stroke} />
          <Path d="M17 3h2a2 2 0 0 1 2 2v2" {...stroke} />
          <Path d="M21 17v2a2 2 0 0 1-2 2h-2" {...stroke} />
          <Path d="M7 21H5a2 2 0 0 1-2-2v-2" {...stroke} />
          <Rect x="7" y="7" width="10" height="10" rx="1" {...stroke} />
        </Svg>
      );
    case 'Rooms':
      return (
        <Svg {...props}>
          <Rect x="3" y="3" width="7" height="7" {...stroke} />
          <Rect x="14" y="3" width="7" height="7" {...stroke} />
          <Rect x="14" y="14" width="7" height="7" {...stroke} />
          <Rect x="3" y="14" width="7" height="7" {...stroke} />
        </Svg>
      );
    case 'Search':
      return (
        <Svg {...props}>
          <Circle cx="11" cy="11" r="8" {...stroke} />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" {...stroke} />
        </Svg>
      );
    case 'Quotes':
      return (
        <Svg {...props}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
          <Polyline points="14 2 14 8 20 8" {...stroke} />
          <Line x1="16" y1="13" x2="8" y2="13" {...stroke} />
          <Line x1="16" y1="17" x2="8" y2="17" {...stroke} />
        </Svg>
      );
    case 'Settings':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="3" {...stroke} />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...stroke} />
        </Svg>
      );
    // Legacy alias
    case 'Catalog':
      return (
        <Svg {...props}>
          <Circle cx="11" cy="11" r="8" {...stroke} />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" {...stroke} />
        </Svg>
      );
    default:
      return <View style={{ width: s, height: s }} />;
  }
}