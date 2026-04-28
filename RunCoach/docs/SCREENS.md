# RunCoach — Screens & User Flows

---

## Screen Inventory

| Screen | Route | Description |
|---|---|---|
| Onboarding — Welcome | `/onboarding/welcome` | App intro, get started CTA |
| Onboarding — Basic Info | `/onboarding/basic` | Age, ability, current mileage, longest run |
| Onboarding — Goal | `/onboarding/goal` | Goal type + optional goal date |
| Onboarding — Schedule | `/onboarding/schedule` | Run days/week, long run day, strength days |
| Onboarding — Injury | `/onboarding/injury` | Multi-select injury history |
| Onboarding — Style | `/onboarding/style` | Conservative / Balanced / Aggressive |
| Onboarding — Generating | `/onboarding/generating` | Animated "building your plan" screen |
| Home | `/home` | This week's overview, today's workout callout |
| Weekly Plan | `/plan` | Full week calendar view with all workouts |
| Workout Detail | `/plan/workout/:id` | Single workout instructions + mark complete |
| Full Plan Overview | `/plan/overview` | Multi-week plan summary (phase/week view) |
| Profile | `/profile` | View/edit user settings |
| Regenerate Confirmation | `/profile/regenerate` | Confirm before deleting and rebuilding plan |

---

## Navigation Structure

```
App
├── OnboardingFlow (if no UserProfile exists)
│   ├── WelcomeView
│   ├── OnboardingView (multi-step container)
│   │   ├── BasicInfoStep
│   │   ├── GoalStep
│   │   ├── ScheduleStep
│   │   ├── InjuryStep
│   │   └── StyleStep
│   └── GeneratingView → (transitions to TabView)
│
└── MainTabView (after onboarding complete)
    ├── Tab: Today (HomeView)
    ├── Tab: Plan (WeeklyPlanView → WorkoutDetailView)
    └── Tab: Profile (ProfileView)
```

---

## User Flows

### Flow 1: First Launch → Plan Generated

```
Launch App
  → No UserProfile found
  → Show WelcomeView
  → User taps "Get Started"
  → OnboardingView (step 1 of 5)
      Step 1: Age slider, ability picker, weekly mileage, longest run
      Step 2: Goal picker, optional date picker
      Step 3: Run days stepper, long run day picker, strength days
      Step 4: Injury multi-select (chips)
      Step 5: Style cards (Conservative / Balanced / Aggressive)
  → Tap "Build My Plan"
  → GeneratingView (1.5s animated delay)
  → TrainingPlanGenerator.generate(profile:) runs
  → Navigate to HomeView (replace onboarding stack)
```

### Flow 2: View Today's Workout

```
HomeView
  → "Today" card shows workout type + distance/duration
  → Tap card → WorkoutDetailView
      → Workout title, type badge, distance, pace guidance
      → Coach's notes explaining the purpose
      → "Mark as Complete" button
  → Tap complete → WorkoutDay.isCompleted = true
  → Navigate back → HomeView reflects completion
```

### Flow 3: Browse the Weekly Plan

```
Tab: Plan → WeeklyPlanView
  → 7-day horizontal scroll (Mon–Sun)
  → Each day shows workout type icon + distance
  → Completed days show checkmark
  → Tap any day → WorkoutDetailView
```

### Flow 4: See the Full Plan

```
WeeklyPlanView → "View Full Plan" button
  → FullPlanOverview (list of weeks)
  → Each week row: week #, total miles, phase label (Base / Build / Peak / Taper)
  → Tap week → expands to show all 7 days inline
```

### Flow 5: Edit Profile & Regenerate Plan

```
Tab: Profile → ProfileView
  → Shows all current settings in grouped list
  → Tap any field → inline edit (sheet or inline)
  → Tap "Regenerate Plan"
  → Confirmation sheet: "This will replace your current plan. Progress will be lost."
  → Confirm → deletes old plan → runs generator → replaces plan
  → Success toast → stays on Profile
```

### Flow 6: Skip / Note a Workout

```
WorkoutDetailView
  → Tap "I'm skipping this"
  → WorkoutDay.isSkipped = true
  → Optional: tap "Add note" → free text field saved to userNotes
```

---

## Screen Wireframe Notes

### HomeView
```
┌─────────────────────────────────┐
│  Good morning, runner.          │
│  Week 3 of 12 · Base phase      │
│                                 │
│ ┌─ TODAY ──────────────────┐    │
│ │  🏃 Easy Run  4.0 mi      │    │
│ │  Keep it conversational  │    │
│ │  [View Workout]          │    │
│ └──────────────────────────┘    │
│                                 │
│ THIS WEEK                       │
│  Mon ✓  Tue ●  Wed ○  Thu ○    │
│  Fri ○  Sat ○  Sun ─           │
│                                 │
│  Weekly target: 22 mi           │
│  Completed: 4 mi                │
└─────────────────────────────────┘
```

### WeeklyPlanView
```
┌─────────────────────────────────┐
│  < Week 3 of 12  >              │
│  Base Phase · 22 miles          │
│                                 │
│  Mon  Easy Run       4.0 mi  ✓  │
│  Tue  Strength       45 min  ●  │
│  Wed  Easy Run       5.0 mi  ○  │
│  Thu  Tempo Run      4.5 mi  ○  │
│  Fri  Rest / Mobility         ○  │
│  Sat  Easy Run       3.5 mi  ○  │
│  Sun  Long Run       8.0 mi  ○  │
│                                 │
│  [View Full Plan]               │
└─────────────────────────────────┘
```

### WorkoutDetailView
```
┌─────────────────────────────────┐
│  Thursday, Week 3               │
│                                 │
│  TEMPO RUN                      │
│  4.5 miles                      │
│                                 │
│  How to run it:                 │
│  1 mi warm-up (easy)            │
│  2.5 mi at tempo pace           │
│  1 mi cool-down (easy)          │
│                                 │
│  Target pace: ~9:30/mi          │
│  (based on your recent runs)    │
│                                 │
│  Why this workout:              │
│  Tempo runs build your lactate  │
│  threshold — the pace you can   │
│  hold for a long time without   │
│  accumulating fatigue.          │
│                                 │
│  [Mark Complete]  [Skip]        │
└─────────────────────────────────┘
```

### OnboardingView (Step 1)
```
┌─────────────────────────────────┐
│  ● ○ ○ ○ ○                     │  ← step dots
│                                 │
│  Tell us about yourself         │
│                                 │
│  Age                            │
│  [──────●────────]  32          │
│                                 │
│  Running experience             │
│  [Beginner] [Intermediate] [Advanced] │
│                                 │
│  Current weekly mileage         │
│  [──●──────────]  12 mi/week   │
│                                 │
│  Longest run in last 4 weeks    │
│  [────●──────────]  6 mi        │
│                                 │
│                      [Next →]   │
└─────────────────────────────────┘
```
