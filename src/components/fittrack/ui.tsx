import type { LucideIcon } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { AlertCircle, CalendarDays, Check, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react-native';
import { PropsWithChildren, ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { formatLocalIsoDate, fullDateLabel, parseIsoDate } from '@/utils/date';

export function AppText({
  children,
  variant = 'body',
  muted,
  color,
  style,
  ...props
}: PropsWithChildren<TextProps & {
  variant?: 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'metric';
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}>) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[
        styles.text,
        variant === 'title' && styles.title,
        variant === 'heading' && styles.heading,
        variant === 'subheading' && styles.subheading,
        variant === 'label' && styles.label,
        variant === 'caption' && styles.caption,
        variant === 'metric' && styles.metric,
        { color: color || (muted ? colors.muted : colors.text) },
        style,
      ]}
      {...props}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.screenInner, { paddingBottom: Math.max(insets.bottom, 12) + 82 }]}>{children}</View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Header({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.nav, borderBottomColor: colors.border }]}>
      <AppText variant="subheading">{title}</AppText>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  pressable,
  onPress,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; pressable?: boolean; onPress?: () => void }>) {
  const { colors, mode } = useAppTheme();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      shadowColor: mode === 'dark' ? '#000' : colors.shadow,
      borderColor: mode === 'dark' ? colors.border : 'transparent',
    },
    style,
  ];
  if (!pressable) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  meta,
  tone,
  style,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'accent' | 'info';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const toneColor = tone && tone !== 'default' ? colors[tone] : colors.text;
  return (
    <Card style={[styles.metricCard, style]}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.metricRow}>
        <AppText variant="metric" color={toneColor}>
          {value}
        </AppText>
        {suffix ? <AppText variant="caption" muted>{suffix}</AppText> : null}
      </View>
      {meta ? <AppText variant="caption" muted numberOfLines={2}>{meta}</AppText> : null}
    </Card>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  active,
  danger,
  label,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  active?: boolean;
  danger?: boolean;
  label?: string;
}) {
  const { colors } = useAppTheme();
  const iconColor = danger ? colors.accent : active ? colors.primary : colors.muted;
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: active ? `${colors.primary}14` : 'transparent' },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}>
      <Icon size={20} color={iconColor} strokeWidth={2.25} />
    </Pressable>
  );
}

export function PillButton({
  children,
  onPress,
  active,
  disabled,
  accessibilityLabel,
  tone = 'primary',
  style,
}: PropsWithChildren<{
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  tone?: 'primary' | 'plain' | 'danger';
  style?: StyleProp<ViewStyle>;
}>) {
  const { colors } = useAppTheme();
  const bg = active || tone === 'primary' ? colors.primary : tone === 'danger' ? `${colors.accent}18` : colors.surfaceAlt;
  const textColor = active || tone === 'primary' ? '#ffffff' : tone === 'danger' ? colors.accent : colors.label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillButton,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}>
      <AppText variant="caption" color={textColor} style={styles.pillButtonText}>
        {children}
      </AppText>
    </Pressable>
  );
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function TextField({
  label,
  style,
  inputStyle,
  ...props
}: TextFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={style}>
      {label ? <AppText variant="caption" muted style={styles.inputLabel}>{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceAlt, color: colors.text },
          inputStyle,
        ]}
        {...props}
      />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  style,
  maximumDate,
  minimumDate,
  compact,
  variant = 'field',
  displayLabel,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  maximumDate?: Date;
  minimumDate?: Date;
  compact?: boolean;
  variant?: 'field' | 'inline';
  displayLabel?: string;
}) {
  const { colors, mode } = useAppTheme();
  const currentDate = parseIsoDate(value) || new Date();
  const [iosVisible, setIosVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(currentDate);

  function handlePickerValueChange(_event: DateTimePickerChangeEvent, nextDate: Date) {
    if (Platform.OS === 'android') {
      onChange(formatLocalIsoDate(nextDate));
      return;
    }
    setDraftDate(nextDate);
  }

  function openPicker() {
    const nextDraft = parseIsoDate(value) || new Date();
    setDraftDate(nextDraft);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: nextDraft,
        mode: 'date',
        display: 'calendar',
        maximumDate,
        minimumDate,
        onValueChange: handlePickerValueChange,
        onDismiss: () => {},
        onNeutralButtonPress: () => {},
      });
      return;
    }
    setIosVisible(true);
  }

  if (Platform.OS === 'web' && variant === 'field') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        style={style}
      />
    );
  }

  const displayValue = value ? displayLabel || fullDateLabel(value) : '';

  return (
    <View style={style}>
      {label ? <AppText variant="caption" muted style={styles.inputLabel}>{label}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || 'Select date'}
        onPress={openPicker}
        style={({ pressed }) => [
          variant === 'inline' ? styles.inlineDateButton : styles.dateField,
          compact && variant === 'field' && styles.dateFieldCompact,
          variant === 'field' && { backgroundColor: colors.surfaceAlt },
          pressed && (variant === 'inline' ? { opacity: 0.7 } : { backgroundColor: colors.surfacePressed }),
        ]}>
        {variant === 'field' ? <CalendarDays size={17} color={colors.primary} /> : null}
        <View style={variant === 'inline' ? styles.inlineDateText : styles.dateFieldText}>
          <AppText
            color={displayValue ? colors.text : colors.muted}
            style={variant === 'inline' ? styles.inlineDateLabel : styles.selectText}
            numberOfLines={1}>
            {displayValue || placeholder}
          </AppText>
          {compact && variant === 'field' && value ? (
            <AppText variant="caption" muted numberOfLines={1}>{value}</AppText>
          ) : null}
        </View>
        {variant === 'inline' ? (
          <CalendarDays size={20} color={colors.primary} strokeWidth={2.4} />
        ) : (
          <ChevronDown size={16} color={colors.muted} />
        )}
      </Pressable>

      <Modal visible={iosVisible} transparent animationType="fade" onRequestClose={() => setIosVisible(false)}>
        <View style={styles.datePickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIosVisible(false)} />
          <View style={[styles.datePickerSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setIosVisible(false)}>
                <AppText color={colors.primary}>Cancel</AppText>
              </Pressable>
              <AppText variant="subheading">{label || 'Date'}</AppText>
              <Pressable
                onPress={() => {
                  onChange(formatLocalIsoDate(draftDate));
                  setIosVisible(false);
                }}>
                <AppText color={colors.primary} style={{ fontWeight: '700' }}>Done</AppText>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="inline"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              themeVariant={mode}
              onValueChange={handlePickerValueChange}
              onDismiss={() => {}}
              style={styles.iosDatePicker}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segment,
              active && { backgroundColor: colors.surface, shadowColor: colors.shadow },
            ]}>
            <AppText variant="caption" color={active ? colors.text : colors.label} style={styles.segmentText}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SelectField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label?: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.75 }}>
      {label ? <AppText variant="caption" muted style={styles.inputLabel}>{label}</AppText> : null}
      <View style={[styles.selectField, { backgroundColor: colors.surfaceAlt }]}>
        <AppText color={value ? colors.text : colors.muted} style={styles.selectText}>
          {value || placeholder}
        </AppText>
        <ChevronDown size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export function ModalSheet({
  visible,
  onClose,
  title,
  actionLabel,
  onAction,
  actionDisabled,
  actionBusy,
  actionTone = 'default',
  children,
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  actionTone?: 'default' | 'danger';
}>) {
  const { colors } = useAppTheme();
  const disabled = actionDisabled || actionBusy;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose}>
              <AppText color={colors.primary}>Cancel</AppText>
            </Pressable>
            <AppText variant="subheading">{title}</AppText>
            {actionLabel ? (
              <Pressable disabled={disabled} onPress={onAction} style={({ pressed }) => [styles.modalAction, pressed && !disabled && { opacity: 0.7 }]}>
                {actionBusy ? (
                  <ActivityIndicator size="small" color={actionTone === 'danger' ? colors.accent : colors.primary} />
                ) : (
                  <AppText
                    color={disabled ? colors.faint : actionTone === 'danger' ? colors.accent : colors.primary}
                    style={{ fontWeight: '700' }}>
                    {actionLabel}
                  </AppText>
                )}
              </Pressable>
            ) : (
              <View style={{ width: 48 }} />
            )}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function OptionRow({
  label,
  meta,
  selected,
  onPress,
}: {
  label: string;
  meta?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        { backgroundColor: selected ? `${colors.primary}1f` : colors.surfaceAlt, borderColor: selected ? `${colors.primary}55` : colors.border },
        pressed && { opacity: 0.8 },
      ]}>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '600' }}>{label}</AppText>
        {meta ? <AppText variant="caption" muted>{meta}</AppText> : null}
      </View>
      <View style={[styles.checkCircle, { borderColor: selected ? colors.primary : colors.faint, backgroundColor: selected ? colors.primary : 'transparent' }]}>
        {selected ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.stateCard}>
      <ActivityIndicator color={colors.primary} />
      <AppText muted>{label}</AppText>
    </Card>
  );
}

export function EmptyState({
  icon: Icon = Loader2,
  title,
  body,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.stateCard}>
      <Icon size={34} color={colors.faint} />
      <AppText style={{ fontWeight: '700' }}>{title}</AppText>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>{body}</AppText>
    </Card>
  );
}

export function Toast({
  message,
  title,
  tone = 'default',
}: {
  message: string;
  title?: string;
  tone?: 'default' | 'success' | 'error';
}) {
  const { colors, mode } = useAppTheme();
  if (!message) return null;
  const toneColor = tone === 'error' ? colors.accent : tone === 'success' ? colors.success : colors.primary;
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: colors.surface,
          borderColor: `${toneColor}55`,
          shadowColor: mode === 'dark' ? '#000' : colors.shadow,
        },
      ]}>
      <View style={[styles.toastIcon, { backgroundColor: `${toneColor}18` }]}>
        <Icon size={18} color={toneColor} strokeWidth={2.5} />
      </View>
      <View style={styles.toastText}>
        <AppText variant="caption" style={styles.toastTitle}>
          {title || message}
        </AppText>
        {title ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {message}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function InlineError({ message }: { message?: string }) {
  const { colors } = useAppTheme();
  if (!message) return null;
  return (
    <View style={[styles.inlineError, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}55` }]}>
      <AppText variant="caption" color={colors.accent} style={{ fontWeight: '700' }}>{message}</AppText>
    </View>
  );
}

export function useShadow() {
  const { colors, mode } = useAppTheme();
  return useMemo(
    () => ({
      shadowColor: mode === 'dark' ? '#000' : colors.shadow,
      shadowOpacity: mode === 'dark' ? 0.16 : 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: mode === 'dark' ? 0 : 2,
    }),
    [colors.shadow, mode],
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: Platform.select({ ios: 'Inter', default: 'System' }),
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  metric: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  screen: { flex: 1 },
  screenInner: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  header: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 110,
    gap: 3,
  },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButton: {
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonText: { fontWeight: '700' },
  inputLabel: { marginBottom: 6, fontWeight: '700' },
  input: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '600',
  },
  dateField: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateFieldCompact: {
    minHeight: 50,
    paddingVertical: 7,
  },
  dateFieldText: {
    flex: 1,
    minWidth: 0,
  },
  inlineDateButton: {
    minHeight: 38,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inlineDateText: {
    minWidth: 0,
  },
  inlineDateLabel: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  selectField: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectText: { flex: 1 },
  segmented: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.sm,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: { fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  modalHeader: {
    height: 50,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalAction: {
    minWidth: 58,
    minHeight: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  datePickerSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  iosDatePicker: {
    alignSelf: 'center',
  },
  optionRow: {
    minHeight: 58,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    minHeight: 138,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 90,
    minHeight: 58,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 50,
  },
  toastIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    minWidth: 0,
  },
  toastTitle: {
    fontWeight: '800',
  },
  inlineError: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
});
