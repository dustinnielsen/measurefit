# RunCoach — App Architecture

## Overview

RunCoach uses a clean MVVM architecture with SwiftData for persistence. All business logic lives in the service layer. Views are dumb; ViewModels own state; Services own rules.

```
┌─────────────────────────────────────────────────────┐
│                        Views                        │
│  (SwiftUI — read from ViewModels, send actions)     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                    ViewModels                       │
│  (ObservableObject — orchestrate services + state)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                    Services                         │
│  TrainingPlanGenerator — pure functions, no state   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  SwiftData Models                   │
│  UserProfile, TrainingPlan, WorkoutDay              │
└─────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Views
- SwiftUI views only — no business logic
- Read published properties from ViewModels
- Call ViewModel methods on user actions
- Navigate via NavigationStack + sheet/fullScreenCover

### ViewModels
- `@Observable` (Swift 5.9 / iOS 17 macro) or `ObservableObject`
- Inject ModelContext via environment
- Call `TrainingPlanGenerator` to build plans
- Own transient UI state (e.g., onboarding step index)

### TrainingPlanGenerator
- Pure struct with no stored state
- Input: `UserProfile` → Output: `TrainingPlan` with `[WorkoutDay]`
- Deterministic: same input always produces same plan
- Fully unit-testable without mocking

### SwiftData Models
- `UserProfile` — persisted user config
- `TrainingPlan` — a generated plan (has many WorkoutDays)
- `WorkoutDay` — a single day's workout

---

## Data Flow

### Onboarding

```
OnboardingView
  → user fills steps
  → OnboardingViewModel.saveProfile()
  → creates UserProfile in ModelContext
  → calls TrainingPlanGenerator.generate(profile:)
  → saves TrainingPlan + WorkoutDays to ModelContext
  → navigates to HomeView
```

### Viewing the Plan

```
HomeView / WeeklyPlanView
  → queries SwiftData for current TrainingPlan
  → renders WorkoutDays for current week
  → tapping a day → WorkoutDetailView
```

### Regenerating the Plan

```
ProfileView
  → user edits a field
  → ProfileViewModel.regeneratePlan()
  → deletes old TrainingPlan
  → calls TrainingPlanGenerator.generate(profile:)
  → saves new plan
```

---

## Directory Structure

```
RunCoach/
├── RunCoachApp.swift          — App entry, ModelContainer setup
├── Models/
│   ├── Enums.swift            — RunningGoal, WorkoutType, etc.
│   ├── UserProfile.swift      — @Model
│   ├── TrainingPlan.swift     — @Model
│   └── WorkoutDay.swift       — @Model
├── Services/
│   └── TrainingPlanGenerator.swift
├── ViewModels/
│   ├── OnboardingViewModel.swift
│   ├── HomeViewModel.swift
│   └── ProfileViewModel.swift
└── Views/
    ├── Onboarding/
    │   ├── OnboardingView.swift
    │   ├── OnboardingStep.swift
    │   └── steps/
    │       ├── BasicInfoStep.swift
    │       ├── RunningAbilityStep.swift
    │       ├── GoalStep.swift
    │       ├── ScheduleStep.swift
    │       └── InjuryStep.swift
    ├── Home/
    │   └── HomeView.swift
    ├── Plan/
    │   ├── WeeklyPlanView.swift
    │   └── WorkoutDetailView.swift
    ├── Profile/
    │   └── ProfileView.swift
    └── Components/
        ├── WorkoutCard.swift
        └── ProgressRing.swift
```

---

## Key Design Decisions

**SwiftData over CoreData**: Less boilerplate, native Swift macros, better SwiftUI integration.

**No backend**: Personal use app; all data on-device removes privacy concerns, network failures, and cost.

**Rule-based generator over LLM**: Predictable, fast, testable, offline. Training science rules are well-established enough that a rule engine is correct and sufficient.

**No Apple Health integration (v1)**: Keeps scope small. Can be added later as an enhancement — `HKWorkout` queries would allow auto-detecting completed runs.

**Single profile (v1)**: One user per device. Multi-profile support is a v2 feature if shared-device households need it.

---

## Dependencies

None. Zero external packages. Pure SwiftUI + SwiftData + Foundation.
