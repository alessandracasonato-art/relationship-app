import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export default function Logo({ size = 'medium', showText = true, variant = 'dark' }: LogoProps) {
  const dimensions = {
    small: { icon: 32, fontSize: 20, subtitleSize: 9, spacing: 6 },
    medium: { icon: 48, fontSize: 30, subtitleSize: 11, spacing: 8 },
    large: { icon: 72, fontSize: 42, subtitleSize: 13, spacing: 12 },
  };

  const d = dimensions[size];
  const textColor = variant === 'dark' ? Colors.text : '#FFFFFF';
  const subtitleColor = variant === 'dark' ? Colors.textLight : 'rgba(255,255,255,0.7)';

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Svg width={d.icon} height={d.icon} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.secondary} stopOpacity="1" />
              <Stop offset="100%" stopColor={Colors.secondaryLight} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor={Colors.primaryLight} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Upper arc - the original */}
          <Path
            d="M25 50 C25 28, 50 12, 75 30 C80 34, 78 42, 72 40 C58 32, 42 38, 38 50"
            fill="none"
            stroke="url(#blueGrad)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Lower arc - the reflection */}
          <Path
            d="M25 52 C25 74, 50 90, 75 72 C80 68, 78 60, 72 62 C58 70, 42 64, 38 52"
            fill="none"
            stroke="url(#goldGrad)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Center accent dot */}
          <Circle cx="50" cy="51" r="4" fill={Colors.secondary} />
        </Svg>

        {showText && (
          <View style={{ marginLeft: d.spacing }}>
            <Text
              style={[
                styles.brandName,
                {
                  fontSize: d.fontSize,
                  color: textColor,
                  letterSpacing: d.fontSize * 0.06,
                },
              ]}
            >
              Riflesso
            </Text>
          </View>
        )}
      </View>

      {showText && size !== 'small' && (
        <Text
          style={[
            styles.tagline,
            {
              fontSize: d.subtitleSize,
              color: subtitleColor,
              letterSpacing: d.subtitleSize * 0.25,
            },
          ]}
        >
          CONSAPEVOLEZZA RELAZIONALE
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    fontWeight: '300',
  },
  tagline: {
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});
