import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const COLORS = {
  primary: '#1769AA',
  primaryDark: '#123B5D',
  primarySoft: '#E8F3FB',
  bg: '#F4F8FB',
  card: '#FFFFFF',
  border: '#DCE7EF',
  text: '#123B5D',
  sub: '#6B8294',
  success: '#1E9E63',
  successSoft: '#E4F6EC',
  warning: '#D98A0B',
  warningSoft: '#FFF3DC',
  danger: '#D14343',
  dangerSoft: '#FDECEC',
};

export function Screen({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function Header({
  title,
  subtitle,
  onBack = true,
  onBackPress,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: boolean;
  onBackPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={() =>
            onBackPress
              ? onBackPress()
              : router.canGoBack()
                ? router.back()
                : undefined
          }
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primaryDark} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatTile({
  icon,
  label,
  value,
  tint = COLORS.primary,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  tint?: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint + '1A' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Pill({
  text,
  color = COLORS.primary,
  bg = COLORS.primarySoft,
}: {
  text: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.centerText}>{text}</Text>
    </View>
  );
}

export function Empty({
  icon = 'file-tray-outline',
  title,
  text,
}: {
  icon?: IconName;
  title: string;
  text?: string;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.centerText}>{text}</Text> : null}
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle-outline" size={20} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  icon?: IconName;
}) {
  const bg =
    variant === 'primary' ? COLORS.primary : variant === 'danger' ? COLORS.dangerSoft : COLORS.primarySoft;
  const fg =
    variant === 'primary' ? '#FFF' : variant === 'danger' ? COLORS.danger : COLORS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export const formatDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 12.5, color: COLORS.sub, marginTop: 2 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12.5, color: COLORS.sub, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 36, gap: 10 },
  centerText: { color: COLORS.sub, fontSize: 13.5, textAlign: 'center' },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
  retry: { color: COLORS.danger, fontWeight: '800', fontSize: 13 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnText: { fontSize: 15, fontWeight: '800' },
});
