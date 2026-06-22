import { Check } from 'lucide-react-native';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';

import { AppText } from './ui';

type CategoryPickerProps = {
  categories: string[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

export function CategoryPicker({
  categories,
  selectedCategories,
  onToggleCategory,
  title = 'Categories',
  style,
}: CategoryPickerProps) {
  const { colors } = useAppTheme();
  const selectedKeys = new Set(selectedCategories.map((category) => category.trim().toLowerCase()));
  const selectedLabel = selectedCategories.length === 1 ? selectedCategories[0] : `${selectedCategories.length} selected`;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <View style={styles.headerRow}>
        <AppText variant="caption" muted>{title}</AppText>
        {selectedCategories.length ? (
          <AppText variant="caption" color={colors.primary} style={styles.selectedLabel}>{selectedLabel}</AppText>
        ) : null}
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((category) => {
          const selected = selectedKeys.has(category.trim().toLowerCase());
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${category}`}
              accessibilityState={{ selected }}
              onPress={() => onToggleCategory(category)}
              style={({ pressed }) => [
                styles.categoryChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <AppText
                variant="caption"
                numberOfLines={1}
                color={selected ? '#ffffff' : colors.label}
                style={styles.categoryText}>
                {category}
              </AppText>
              {selected ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectedLabel: {
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    minHeight: 40,
    maxWidth: '100%',
    flexShrink: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryText: {
    flexShrink: 1,
    fontWeight: '800',
  },
});
