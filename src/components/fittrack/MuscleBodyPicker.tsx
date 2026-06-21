import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';

import { AppText } from './ui';

type MuscleBodyPickerProps = {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  style?: StyleProp<ViewStyle>;
};

type RegionProps = {
  category: string;
  available: boolean;
  selected: boolean;
  onSelect: (category: string) => void;
  children: ReactNode;
};

export function MuscleBodyPicker({
  categories,
  selectedCategory,
  onSelectCategory,
  style,
}: MuscleBodyPickerProps) {
  const { colors } = useAppTheme();
  const availableCategories = new Set(categories.map((category) => category.toLowerCase()));
  const hasCardio = availableCategories.has('cardio');

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <View style={styles.headerRow}>
        <AppText variant="caption" muted>Muscle Group</AppText>
        {selectedCategory ? (
          <AppText variant="caption" color={colors.primary} style={styles.selectedLabel}>{selectedCategory}</AppText>
        ) : null}
      </View>
      <View style={styles.mapsRow}>
        <BodyMap
          label="Front"
          categories={availableCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          side="front"
        />
        <BodyMap
          label="Back"
          categories={availableCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          side="back"
        />
      </View>
      {hasCardio ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cardio"
          onPress={() => onSelectCategory('Cardio')}
          style={({ pressed }) => [
            styles.cardioChip,
            {
              backgroundColor: selectedCategory === 'Cardio' ? colors.primary : colors.surface,
              borderColor: selectedCategory === 'Cardio' ? colors.primary : colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <AppText
            variant="caption"
            color={selectedCategory === 'Cardio' ? '#ffffff' : colors.label}
            style={styles.cardioText}>
            Cardio
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function BodyMap({
  label,
  categories,
  selectedCategory,
  onSelectCategory,
  side,
}: {
  label: string;
  categories: Set<string>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  side: 'front' | 'back';
}) {
  const { colors, mode } = useAppTheme();
  const panelBackground = mode === 'dark' ? '#151618' : colors.surface;

  function isAvailable(category: string) {
    return categories.has(category.toLowerCase());
  }

  function renderRegion(category: string, children: ReactNode) {
    return (
      <MuscleRegion
        category={category}
        available={isAvailable(category)}
        selected={selectedCategory === category}
        onSelect={onSelectCategory}>
        {children}
      </MuscleRegion>
    );
  }

  return (
    <View style={[styles.mapPanel, { backgroundColor: panelBackground, borderColor: colors.border }]}>
      <AppText variant="caption" muted style={styles.mapLabel}>{label}</AppText>
      <Svg width="100%" height={236} viewBox="0 0 180 284">
        <BodySilhouette side={side} />
        {side === 'front' ? (
          <>
            {renderRegion(
              'Shoulders',
              <>
                <Path d="M48 83 C32 86 22 98 18 114 C29 116 45 111 58 101 C61 92 57 85 48 83 Z" />
                <Path d="M132 83 C148 86 158 98 162 114 C151 116 135 111 122 101 C119 92 123 85 132 83 Z" />
              </>,
            )}
            {renderRegion(
              'Chest',
              <>
                <Path d="M61 95 C69 83 85 84 90 99 C87 116 69 122 54 112 C53 105 55 99 61 95 Z" />
                <Path d="M90 99 C95 84 111 83 119 95 C125 99 127 105 126 112 C111 122 93 116 90 99 Z" />
              </>,
            )}
            {renderRegion(
              'Abs',
              <>
                <Path d="M72 121 C78 117 86 117 90 124 L90 139 C84 142 77 142 71 138 C69 132 69 126 72 121 Z" />
                <Path d="M90 124 C94 117 102 117 108 121 C111 126 111 132 109 138 C103 142 96 142 90 139 Z" />
                <Path d="M70 143 C76 147 84 148 90 145 L90 160 C84 165 76 164 71 159 C68 153 68 148 70 143 Z" />
                <Path d="M90 145 C96 148 104 147 110 143 C112 148 112 153 109 159 C104 164 96 165 90 160 Z" />
                <Path d="M72 164 C78 169 85 171 90 166 L90 190 C84 198 76 195 72 185 C69 176 69 169 72 164 Z" />
                <Path d="M90 166 C95 171 102 169 108 164 C111 169 111 176 108 185 C104 195 96 198 90 190 Z" />
              </>,
            )}
            {renderRegion(
              'Biceps',
              <>
                <Path d="M26 113 C35 105 48 105 56 114 C52 128 48 146 44 162 C41 173 27 172 25 160 C23 143 23 126 26 113 Z" />
                <Path d="M154 113 C145 105 132 105 124 114 C128 128 132 146 136 162 C139 173 153 172 155 160 C157 143 157 126 154 113 Z" />
              </>,
            )}
            {renderRegion(
              'Quads',
              <>
                <Path d="M59 182 C69 187 81 190 90 187 C86 207 82 235 76 257 C72 272 57 273 52 258 C51 235 53 205 59 182 Z" />
                <Path d="M121 182 C111 187 99 190 90 187 C94 207 98 235 104 257 C108 272 123 273 128 258 C129 235 127 205 121 182 Z" />
              </>,
            )}
          </>
        ) : (
          <>
            {renderRegion(
              'Shoulders',
              <>
                <Path d="M48 83 C32 86 22 98 18 114 C29 116 45 111 58 101 C61 92 57 85 48 83 Z" />
                <Path d="M132 83 C148 86 158 98 162 114 C151 116 135 111 122 101 C119 92 123 85 132 83 Z" />
              </>,
            )}
            {renderRegion(
              'Back',
              <>
                <Path d="M60 90 C71 78 109 78 120 90 C132 115 130 154 118 178 C108 198 98 206 90 207 C82 206 72 198 62 178 C50 154 48 115 60 90 Z" />
                <Path d="M64 101 C72 112 79 130 84 153 C75 148 65 133 57 115 Z" />
                <Path d="M116 101 C108 112 101 130 96 153 C105 148 115 133 123 115 Z" />
              </>,
            )}
            {renderRegion(
              'Triceps',
              <>
                <Path d="M26 113 C35 105 48 105 56 114 C52 128 48 146 44 162 C41 173 27 172 25 160 C23 143 23 126 26 113 Z" />
                <Path d="M154 113 C145 105 132 105 124 114 C128 128 132 146 136 162 C139 173 153 172 155 160 C157 143 157 126 154 113 Z" />
              </>,
            )}
            {renderRegion(
              'Hamstrings',
              <>
                <Path d="M59 182 C69 187 81 190 90 187 C86 207 82 235 76 257 C72 272 57 273 52 258 C51 235 53 205 59 182 Z" />
                <Path d="M121 182 C111 187 99 190 90 187 C94 207 98 235 104 257 C108 272 123 273 128 258 C129 235 127 205 121 182 Z" />
              </>,
            )}
          </>
        )}
        <BodyDetailLines side={side} />
      </Svg>
    </View>
  );
}

function BodySilhouette({ side }: { side: 'front' | 'back' }) {
  const { mode } = useAppTheme();
  const fill = mode === 'dark' ? '#3d4145' : '#3f464a';
  const stroke = mode === 'dark' ? '#d4d8dc' : '#f7f9fb';
  const hair = mode === 'dark' ? '#202225' : '#2e3337';

  return (
    <G fill={fill} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M70 21 C80 10 101 15 106 32 C109 47 100 62 90 66 C78 65 66 55 64 41 C62 33 64 26 70 21 Z" />
      <Path d="M67 22 C75 10 96 13 103 26 C92 27 80 32 69 40 C68 34 67 28 67 22 Z" fill={hair} stroke={hair} />
      <Path d="M72 62 C77 73 103 73 108 62 L111 85 C100 92 80 92 69 85 Z" />
      <Path d="M55 84 C69 72 111 72 125 84 C140 91 152 103 161 124 C146 127 132 121 121 108 C127 130 128 158 119 181 C111 202 101 214 94 225 C92 229 88 229 86 225 C79 214 69 202 61 181 C52 158 53 130 59 108 C48 121 34 127 19 124 C28 103 40 91 55 84 Z" />
      <Path d="M50 94 C36 105 27 122 22 145 L13 194 C10 211 20 224 34 216 C45 210 48 181 53 157 C57 134 62 115 70 101 Z" />
      <Path d="M130 94 C144 105 153 122 158 145 L167 194 C170 211 160 224 146 216 C135 210 132 181 127 157 C123 134 118 115 110 101 Z" />
      <Path d="M59 181 C52 204 48 234 47 258 C46 276 61 286 75 272 C85 262 87 222 90 188 C93 222 95 262 105 272 C119 286 134 276 133 258 C132 234 128 204 121 181 C110 188 70 188 59 181 Z" />
      {side === 'front' ? (
        <Path d="M61 178 C74 186 106 186 119 178" fill="none" />
      ) : (
        <Path d="M58 94 C69 101 111 101 122 94" fill="none" />
      )}
    </G>
  );
}

function BodyDetailLines({ side }: { side: 'front' | 'back' }) {
  const { mode } = useAppTheme();
  const line = mode === 'dark' ? '#f2f2f7' : '#ffffff';

  return (
    <G fill="none" stroke={line} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} pointerEvents="none">
      <Path d="M90 90 L90 220" />
      <Path d="M58 100 C68 108 80 112 90 112 C100 112 112 108 122 100" />
      <Path d="M57 178 C72 186 108 186 123 178" />
      <Path d="M53 125 C51 142 53 160 62 180" />
      <Path d="M127 125 C129 142 127 160 118 180" />
      <Path d="M62 190 C72 207 77 232 76 257" />
      <Path d="M118 190 C108 207 103 232 104 257" />
      <Path d="M57 195 C64 211 67 231 65 252" />
      <Path d="M123 195 C116 211 113 231 115 252" />
      {side === 'front' ? (
        <>
          <Path d="M58 90 C70 100 78 104 90 99 C102 104 110 100 122 90" />
          <Path d="M65 118 C72 123 82 125 90 123 C98 125 108 123 115 118" />
          <Path d="M71 140 C80 144 100 144 109 140" />
          <Path d="M70 161 C80 166 100 166 110 161" />
          <Path d="M70 92 C71 101 66 110 56 113" />
          <Path d="M110 92 C109 101 114 110 124 113" />
        </>
      ) : (
        <>
          <Path d="M61 95 C73 110 82 136 87 164" />
          <Path d="M119 95 C107 110 98 136 93 164" />
          <Path d="M68 91 C78 99 102 99 112 91" />
          <Path d="M64 115 C72 122 80 132 86 147" />
          <Path d="M116 115 C108 122 100 132 94 147" />
        </>
      )}
    </G>
  );
}

function MuscleRegion({ category, available, selected, onSelect, children }: RegionProps) {
  const { colors, mode } = useAppTheme();
  const fill = selected ? colors.primary : mode === 'dark' ? '#8d9499' : '#bfc5c8';
  const stroke = selected ? colors.primaryHover : mode === 'dark' ? '#f2f2f7' : '#ffffff';

  return (
    <G
      opacity={available ? 1 : 0.35}
      onPress={available ? () => onSelect(category) : undefined}
      fill={fill}
      fillOpacity={selected ? 0.96 : 0.92}
      stroke={stroke}
      strokeWidth={selected ? 2.6 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </G>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
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
  mapsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mapPanel: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapLabel: {
    alignSelf: 'flex-start',
    fontWeight: '700',
  },
  cardioChip: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardioText: {
    fontWeight: '800',
  },
});
