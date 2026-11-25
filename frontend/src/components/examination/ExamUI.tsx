import React from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';

export const EXAM_COLORS = {
  primary: '#1769AA', primaryDark: '#104E85', background: '#F4F8FC',
  white: '#FFFFFF', heading: '#183B56', text: '#64748B',
  muted: '#94A3B8', border: '#E2EAF2', lightBlue: '#EAF3FC',
  green: '#159B75', red: '#D94B4B', orange: '#E99A32',
};

export function ExamPage({ children, refreshing }: { children: React.ReactNode; refreshing?: boolean }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ExamHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>VPROTECH • EXAMINATION</Text>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export function ExamCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ExamButton({ title, onPress, disabled, secondary, loading }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; loading?: boolean;
}) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled, pressed && !disabled && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color={secondary ? EXAM_COLORS.primary : '#fff'} /> :
        <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>}
    </Pressable>
  );
}

export function ExamField({ label, multiline, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={EXAM_COLORS.muted}
        style={[styles.input, multiline && styles.multiline, style]}
      />
    </View>
  );
}

export function ExamPill({ text, color = EXAM_COLORS.primary }: { text: string; color?: string }) {
  return <View style={[styles.pill, { backgroundColor: `${color}18` }]}><Text style={[styles.pillText, { color }]}>{text}</Text></View>;
}

export function ExamNotice({ text, error }: { text: string; error?: boolean }) {
  return <View style={[styles.notice, error && { backgroundColor: '#FDECEC' }]}><Text style={{ color: error ? EXAM_COLORS.red : EXAM_COLORS.heading }}>{text}</Text></View>;
}

export function ExamLoading() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={EXAM_COLORS.primary} /><Text style={styles.subtitle}>Loading examination data…</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EXAM_COLORS.background },
  content: { padding: 18, paddingBottom: 40, maxWidth: 850, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: EXAM_COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: EXAM_COLORS.border },
  backText: { color: EXAM_COLORS.primary, fontSize: 32, lineHeight: 34, marginTop: -4 },
  brand: { color: EXAM_COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: EXAM_COLORS.heading, fontSize: 25, fontWeight: '800' },
  subtitle: { color: EXAM_COLORS.text, fontSize: 13, marginTop: 4, lineHeight: 19 },
  card: { backgroundColor: EXAM_COLORS.white, borderWidth: 1, borderColor: EXAM_COLORS.border, borderRadius: 17, padding: 16, marginBottom: 13, shadowColor: '#17324D', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  button: { backgroundColor: EXAM_COLORS.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  buttonSecondary: { backgroundColor: EXAM_COLORS.lightBlue, borderWidth: 1, borderColor: '#C9DFF2' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  buttonSecondaryText: { color: EXAM_COLORS.primary },
  label: { color: EXAM_COLORS.heading, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: EXAM_COLORS.border, backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: EXAM_COLORS.heading, fontSize: 14 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  pill: { alignSelf: 'flex-start', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 5, marginTop: 7 },
  pillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  notice: { backgroundColor: '#EAF3FC', padding: 12, borderRadius: 11, marginBottom: 12 },
  loading: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

export const examTextStyles = StyleSheet.create({
  name: { color: EXAM_COLORS.heading, fontWeight: '800', fontSize: 16 },
  meta: { color: EXAM_COLORS.text, fontSize: 12, marginTop: 5, lineHeight: 18 },
  section: { color: EXAM_COLORS.heading, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  option: { borderWidth: 1, borderColor: EXAM_COLORS.border, backgroundColor: '#fff', padding: 13, borderRadius: 11, marginTop: 8 },
  optionSelected: { borderColor: EXAM_COLORS.primary, backgroundColor: EXAM_COLORS.lightBlue },
  optionText: { color: EXAM_COLORS.heading, fontSize: 14 },
});
