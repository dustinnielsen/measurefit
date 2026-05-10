import React, { useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { PrimaryButton } from '../src/components/ui/Buttons';
import type { Shoe } from '../src/types/models';

export default function ShoesScreen() {
  const shoes      = useAppStore(s => s.shoes);
  const { addShoe, retireShoe } = useAppStore();

  const [adding, setAdding]   = useState(false);
  const [brand, setBrand]     = useState('');
  const [name, setName]       = useState('');
  const [alertMiles, setAlertMiles] = useState('500');

  const active  = shoes.filter(s => !s.retired);
  const retired = shoes.filter(s => s.retired);

  async function handleAdd() {
    const alert = parseInt(alertMiles, 10);
    if (!brand.trim() || !name.trim() || isNaN(alert)) return;
    await addShoe({ brand: brand.trim(), name: name.trim(), alertMiles: alert, retired: false });
    setBrand(''); setName(''); setAlertMiles('500');
    setAdding(false);
  }

  function confirmRetire(shoe: Shoe) {
    Alert.alert(
      'Retire shoe?',
      `${shoe.brand} ${shoe.name} will be moved to retired shoes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retire', style: 'destructive', onPress: () => retireShoe(shoe.id) },
      ],
    );
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Shoe Tracker</Text>
          <TouchableOpacity onPress={() => setAdding(a => !a)} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>{adding ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {/* Recommendation banner */}
        <TouchableOpacity
          style={styles.recBanner}
          onPress={() => router.push('/shoe-recommendations' as any)}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 20 }}>⭐</Text>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
              Get shoe recommendations
            </Text>
            <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
              Top 3 picks based on your training plan
            </Text>
          </View>
          <Text style={{ color: Colors.accent }}>›</Text>
        </TouchableOpacity>

        {/* Add form */}
        {adding && (
          <Card style={{ marginBottom: Spacing.lg, gap: Spacing.md }}>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: 4 }]}>NEW SHOE</Text>
            <TextInput
              style={styles.input}
              placeholder="Brand (e.g. Nike)"
              placeholderTextColor={Colors.textTertiary}
              value={brand}
              onChangeText={setBrand}
            />
            <TextInput
              style={styles.input}
              placeholder="Model (e.g. Vaporfly 3)"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
            />
            <View style={[CommonStyles.rowBetween, { gap: Spacing.md }]}>
              <Text style={[Typography.subhead, { color: Colors.textSecondary, flex: 1 }]}>Alert at miles</Text>
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'right' }]}
                keyboardType="numeric"
                value={alertMiles}
                onChangeText={setAlertMiles}
              />
            </View>
            <PrimaryButton label="Add Shoe" onPress={handleAdd} />
          </Card>
        )}

        {/* Active shoes */}
        {active.length === 0 && !adding ? (
          <Card style={{ alignItems: 'center', padding: Spacing.xxl }}>
            <Text style={{ fontSize: 48 }}>👟</Text>
            <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>No shoes yet</Text>
            <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              Add your running shoes to track mileage and know when to replace them.
            </Text>
          </Card>
        ) : (
          active.map(shoe => <ShoeCard key={shoe.id} shoe={shoe} onRetire={() => confirmRetire(shoe)} />)
        )}

        {/* Retired shoes */}
        {retired.length > 0 && (
          <>
            <Text style={[Typography.label, { color: Colors.textTertiary, marginTop: Spacing.xl, marginBottom: Spacing.sm }]}>
              RETIRED
            </Text>
            {retired.map(shoe => <ShoeCard key={shoe.id} shoe={shoe} retired />)}
          </>
        )}

        <Text style={[Typography.caption1, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl }]}>
          Most running shoes last 300–500 miles. Replace sooner if you notice increased soreness or reduced cushioning.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShoeCard({ shoe, onRetire, retired = false }: { shoe: Shoe; onRetire?: () => void; retired?: boolean }) {
  const pct       = Math.min(shoe.totalMiles / shoe.alertMiles, 1);
  const isWarning = shoe.totalMiles >= shoe.alertMiles * 0.9;
  const barColor  = isWarning ? Colors.warning : Colors.accent;

  return (
    <Card style={[styles.shoeCard, retired && { opacity: 0.6 }]}>
      <View style={CommonStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.headline, { color: Colors.textPrimary }]}>
            {shoe.brand} {shoe.name}
          </Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
            Added {new Date(shoe.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {shoe.retiredAt ? `  ·  Retired ${new Date(shoe.retiredAt).toLocaleDateString()}` : ''}
          </Text>
        </View>
        <Text style={{ fontSize: 28 }}>👟</Text>
      </View>

      {/* Mileage bar */}
      <View style={styles.mileageRow}>
        <Text style={[Typography.subhead, { color: isWarning ? Colors.warning : Colors.textPrimary, fontWeight: '700' }]}>
          {shoe.totalMiles.toFixed(0)} mi
        </Text>
        <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
          of {shoe.alertMiles} mi
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>

      {isWarning && !retired && (
        <Text style={[Typography.caption1, { color: Colors.warning, marginTop: Spacing.sm }]}>
          ⚠️  Approaching replacement mileage — consider a new pair
        </Text>
      )}

      {!retired && onRetire && (
        <TouchableOpacity onPress={onRetire} style={{ marginTop: Spacing.md, alignSelf: 'flex-end' }}>
          <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>Retire shoe</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  input:      { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, ...Typography.subhead },
  shoeCard:   { marginBottom: Spacing.md },
  mileageRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.md },
  barTrack:   { height: 6, backgroundColor: Colors.tertiary, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 3 },
  recBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: Colors.accent + '40' },
});
