import React from 'react';
import {
  Linking, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { PrimaryButton } from '../src/components/ui/Buttons';
import { getShoeRecommendations, type ShoeRecommendation } from '../src/services/ShoeRecommendationService';
import { GOAL_LABELS } from '../src/types/enums';

export default function ShoeRecommendationsScreen() {
  const profile = useAppStore(s => s.profile);
  const shoes   = useAppStore(s => s.shoes);

  if (!profile) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <View style={[CommonStyles.flex1, CommonStyles.center, { padding: Spacing.xl }]}>
          <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center' }]}>
            Complete onboarding first.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ownedShoeIds = shoes.map(s => s.name.toLowerCase().replace(/\s+/g, '-'));
  const recs = getShoeRecommendations({
    goal:         profile.goal,
    ability:      profile.ability,
    weeklyMileage: profile.weeklyMileage,
    trainingStyle: profile.trainingStyle,
    ownedShoeIds,
  });

  function openShop(url: string) {
    Linking.openURL(url).catch(() => {});
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Shoe Guide</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Personalization banner */}
        <View style={styles.banner}>
          <Text style={{ fontSize: 32 }}>👟</Text>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.headline, { color: Colors.textPrimary }]}>
              Built for your training
            </Text>
            <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
              {GOAL_LABELS[profile.goal]}  ·  {profile.weeklyMileage.toFixed(0)} mi/wk
            </Text>
          </View>
        </View>

        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginBottom: Spacing.xl }]}>
          The right shoe for each job in your rotation. Links go to Running Warehouse and Amazon.
        </Text>

        {recs.map((rec, i) => (
          <ShoeCard key={rec.shoe.id} rec={rec} index={i} onShop={() => openShop(rec.shoe.shopUrl)} />
        ))}

        {/* Rotation tip */}
        <Card style={styles.tipCard}>
          <Text style={[Typography.label, { color: Colors.accent, marginBottom: Spacing.sm }]}>
            💡  PRO TIP — BUILD A ROTATION
          </Text>
          <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>
            Rotating 2–3 pairs extends each shoe's life by up to 50% and reduces injury risk by giving the foam full recovery time between runs.
          </Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            Track your miles in the Shoe Tracker so you know exactly when to replace each pair.
          </Text>
          <TouchableOpacity
            style={styles.trackerBtn}
            onPress={() => { router.back(); router.push('/shoes' as any); }}
          >
            <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '700' }]}>
              Open Shoe Tracker →
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Affiliate disclosure */}
        <Text style={[Typography.caption2, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl, lineHeight: 16 }]}>
          Links may earn Cinder a small commission at no extra cost to you. We only recommend shoes we'd actually run in.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShoeCard({ rec, index, onShop }: { rec: ShoeRecommendation; index: number; onShop: () => void }) {
  const { shoe } = rec;
  const rankColors = [Colors.accent, '#A78BFA', '#34D399'];
  const color = rankColors[index] ?? Colors.accent;

  return (
    <Card style={[styles.shoeCard, { borderColor: color + '30', borderWidth: 1.5 }]}>
      {/* Rank badge + slot label */}
      <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.md }]}>
        <View style={[styles.rankBadge, { backgroundColor: color + '18' }]}>
          <Text style={[Typography.caption1, { color, fontWeight: '800' }]}>#{rec.rank}</Text>
        </View>
        <Text style={[Typography.caption1, { color: Colors.textSecondary, fontWeight: '600' }]}>
          {rec.slotLabel}
        </Text>
      </View>

      {/* Shoe info */}
      <View style={CommonStyles.row}>
        <Text style={{ fontSize: 44 }}>{shoe.emoji}</Text>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>{shoe.brand.toUpperCase()}</Text>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>{shoe.name}</Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
            ${shoe.price}  ·  {cushionLabel(shoe.cushion)}  ·  {shoe.surfaces.join(' / ')}
          </Text>
        </View>
      </View>

      {/* Why this shoe */}
      <View style={[styles.reasonBox, { borderLeftColor: color }]}>
        <Text style={[Typography.caption1, { color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 }]}>
          WHY FOR YOU
        </Text>
        <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>{rec.reason}</Text>
      </View>

      {/* Description */}
      <Text style={[Typography.caption1, { color: Colors.textTertiary, marginBottom: Spacing.md }]}>
        {shoe.description}
      </Text>

      {/* CTA */}
      <TouchableOpacity style={[styles.shopBtn, { backgroundColor: color }]} onPress={onShop} activeOpacity={0.85}>
        <Text style={[Typography.subhead, { color: '#fff', fontWeight: '700' }]}>
          Shop Now  →
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

function cushionLabel(c: 'minimal' | 'moderate' | 'max'): string {
  return { minimal: 'Minimal cushion', moderate: 'Moderate cushion', max: 'Max cushion' }[c];
}

const styles = StyleSheet.create({
  scroll:   { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },

  banner:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.accent },

  shoeCard:    { marginBottom: Spacing.lg },
  rankBadge:   { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  reasonBox:   { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, marginVertical: Spacing.md, borderLeftWidth: 3 },
  shopBtn:     { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },

  tipCard:     { marginTop: Spacing.sm },
  trackerBtn:  { marginTop: Spacing.md, alignSelf: 'flex-start' },
});
