import React, { useCallback, useRef } from 'react';
import { View,  StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppText as Text, useTheme } from '../theme';

const START_ANGLE = -135; // value = 0
const END_ANGLE = 135;    // value = 5
const SWEEP = END_ANGLE - START_ANGLE;

function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleInRadians), y: cy + r * Math.sin(angleInRadians) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

function angleForValue(value) {
  return START_ANGLE + (value / 5) * SWEEP;
}

function valueForRawAngle(rawAngle) {
  let angle = rawAngle;
  if (angle > END_ANGLE && angle <= 180) angle = END_ANGLE;
  if (angle < START_ANGLE && angle >= -180) angle = START_ANGLE;
  const clamped = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));
  const raw = ((clamped - START_ANGLE) / SWEEP) * 5;
  return Math.max(0, Math.min(5, Math.round(raw)));
}

export default function RatingDial({ value, onChange, color = '#6C5CE7', label, size = 130, readOnly = false, displayText, compact = false, glow = false }) {
  const { theme } = useTheme();
  const radius = size / 2;
  const strokeWidth = compact ? Math.max(5, Math.round(size * 0.08)) : 12;
  const r = radius - strokeWidth;
  const cx = radius;
  const cy = radius;

  const handleTouch = useCallback((evt) => {
    if (readOnly) return;
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    const rawAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    onChange(valueForRawAngle(rawAngle));
  }, [cx, cy, onChange, readOnly]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !readOnly,
      onMoveShouldSetPanResponder: () => !readOnly,
      onPanResponderGrant: handleTouch,
      onPanResponderMove: handleTouch,
    })
  ).current;

  const trackPath = describeArc(cx, cy, r, START_ANGLE, END_ANGLE);
  const currentAngle = angleForValue(value ?? 0);
  const progressPath = value > 0 ? describeArc(cx, cy, r, START_ANGLE, currentAngle) : null;
  const knobPos = polarToCartesian(cx, cy, r, currentAngle);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, compact && styles.compactLabel, { color }]}>{label}</Text> : null}
      <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
        <Svg width={size} height={size}>
          {glow && (
            <>
              <Path d={trackPath} stroke={color} strokeWidth={strokeWidth + 10} strokeOpacity={0.1} fill="none" strokeLinecap="round" />
              <Path d={trackPath} stroke={color} strokeWidth={strokeWidth + 5} strokeOpacity={0.14} fill="none" strokeLinecap="round" />
            </>
          )}
          <Path d={trackPath} stroke={theme.border} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          {progressPath && (
            <>
              {glow && <Path d={progressPath} stroke={color} strokeWidth={strokeWidth + 8} strokeOpacity={0.28} fill="none" strokeLinecap="round" />}
              <Path d={progressPath} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            </>
          )}
          <Circle cx={knobPos.x} cy={knobPos.y} r={strokeWidth / 2 + 4} fill={theme.background} stroke={color} strokeWidth={3} />
        </Svg>
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={[styles.valueText, compact && { fontSize: size * 0.24 }, { color: theme.text }]}>{displayText ?? (value ?? 0)}</Text>
          <Text style={[styles.maxText, compact && { fontSize: Math.max(8, size * 0.09) }, { color: theme.muted }]}>/5</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  compactLabel: { fontSize: 12, marginBottom: 4 },
  centerLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  valueText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  maxText: { color: '#9aa0a6', fontSize: 12, marginTop: -4 },
});