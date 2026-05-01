import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAppStore, currentWeekNumber, completedMilesThisWeek, weeklyMileage } from '../src/store/useAppStore';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import { GOAL_LABELS, ABILITY_LABELS, WorkoutType } from '../src/types/enums';
import { getPaceZones } from '../src/services/PaceService';

const ANTHROPIC_API_KEY: string = Constants.expoConfig?.extra?.anthropicApiKey ?? '';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

function buildSystemPrompt(context: string): string {
  return `You are Cinder Coach, a warm, knowledgeable running coach inside the Cinder training app. You give concise, practical advice grounded in 80/20 training principles and exercise science. You know the runner's full context below — reference it naturally, not robotically.

Be encouraging but honest. Keep responses short (2–4 sentences unless a detailed breakdown is asked for). Never suggest stopping training for minor issues — guide adjustments instead. You don't need to introduce yourself every message.

Runner context:
${context}`;
}

function buildContext(
  profile: any,
  plan: any,
  feedback: any[],
): string {
  if (!profile || !plan) return 'No plan loaded yet.';

  const week      = currentWeekNumber(plan);
  const doneMi    = completedMilesThisWeek(plan);
  const targetMi  = weeklyMileage(plan, week);
  const zones     = getPaceZones(profile.ability, profile.goal);
  const todayW    = plan.workoutDays.find((w: any) => {
    const d = new Date(w.date); const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  });
  const recentRPE = feedback.slice(-3).map((f: any) => f.rpe).join(', ');

  return [
    `Ability: ${ABILITY_LABELS[profile.ability as keyof typeof ABILITY_LABELS]}`,
    `Goal: ${GOAL_LABELS[profile.goal as keyof typeof GOAL_LABELS]}`,
    `Plan: Week ${week} of ${plan.totalWeeks}`,
    `This week: ${doneMi.toFixed(1)} of ${targetMi.toFixed(0)} miles done`,
    `Today: ${todayW ? `${todayW.workoutType} — ${todayW.distanceMiles?.toFixed(1) ?? '?'} mi` : 'Rest day'}`,
    `Easy pace target: ${zones.easy[0]}–${zones.easy[1]} /mi`,
    `Tempo pace target: ${zones.tempo[0]}–${zones.tempo[1]} /mi`,
    recentRPE ? `Recent RPE scores: ${recentRPE}` : '',
    profile.goalDate ? `Race date: ${new Date(profile.goalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : '',
  ].filter(Boolean).join('\n');
}

async function askClaude(messages: Message[], systemPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "I'm not connected yet — add your Anthropic API key to app/coach-chat.tsx to activate me.";
  }

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.text })),
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? 'No response.';
}

export default function CoachChatScreen() {
  const { profile, plan, feedback } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `Hey! I'm your Cinder coach. Ask me anything — pacing, recovery, what today's workout is building, or how your training is going.`,
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const listRef               = useRef<FlatList>(null);

  const systemPrompt = buildSystemPrompt(buildContext(profile, plan, feedback));

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const reply = await askClaude(next, systemPrompt);
      setMessages(m => [...m, { id: Date.now().toString() + 'r', role: 'assistant', text: reply }]);
    } catch (e: any) {
      setMessages(m => [...m, { id: Date.now().toString() + 'e', role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[Typography.subhead, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[Typography.headline, { color: Colors.textPrimary }]}>🔥  Coach</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[Typography.subhead, {
                color: item.role === 'user' ? '#fff' : Colors.textPrimary,
                lineHeight: 22,
              }]}>
                {item.text}
              </Text>
            </View>
          )}
          ListFooterComponent={loading ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
          ) : null}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: input.trim() && !loading ? 1 : 0.4 }]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator },
  list:       { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  bubble:     { maxWidth: '82%', borderRadius: Radius.lg, padding: Spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.accent },
  aiBubble:   { alignSelf: 'flex-start', backgroundColor: Colors.surface },
  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  input:      { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, color: Colors.textPrimary, maxHeight: 120, ...Typography.subhead as any },
  sendBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
});
