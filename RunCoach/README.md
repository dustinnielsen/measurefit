# RunCoach

A personal iOS running coach app. Generates structured, adaptive weekly training plans based on your fitness profile and goal. No backend, no subscription, no tracking — just good training science on your device.

## Requirements

- Xcode 15+
- iOS 17+ (SwiftData)
- No external dependencies

## Setup

1. Open Xcode → File → New → Project → iOS App
2. Product Name: `RunCoach`
3. Interface: SwiftUI, Storage: SwiftData, Language: Swift
4. Replace the generated files with the files in `RunCoach/` (this folder)
5. Build and run on simulator or device

The app auto-detects whether a user profile exists. First launch shows onboarding; subsequent launches go straight to the home tab.

## Project Structure

```
RunCoach/
├── RunCoachApp.swift          — Entry point + ModelContainer
├── Models/
│   ├── Enums.swift            — All enums (RunningGoal, WorkoutType, etc.)
│   ├── UserProfile.swift      — SwiftData model: user config
│   ├── TrainingPlan.swift     — SwiftData model: generated plan
│   └── WorkoutDay.swift       — SwiftData model: single day's workout
├── Services/
│   └── TrainingPlanGenerator.swift  — Pure plan generation logic
├── ViewModels/
│   ├── OnboardingViewModel.swift
├── Views/
│   ├── Onboarding/
│   │   ├── OnboardingView.swift     — Multi-step container + generating screen
│   │   └── OnboardingSteps.swift    — All 5 onboarding step views
│   ├── Home/
│   │   └── HomeView.swift           — Today card, week mini-calendar
│   ├── Plan/
│   │   ├── WeeklyPlanView.swift     — Week navigator + full plan sheet
│   │   └── WorkoutDetailView.swift  — Single workout + mark complete
│   └── Profile/
│       └── ProfileView.swift        — Settings display + regenerate
```

## Docs

- [Requirements](docs/REQUIREMENTS.md) — Full PRD with training rules
- [Architecture](docs/ARCHITECTURE.md) — MVVM layers, data flow, design decisions
- [Database Schema](docs/DATABASE_SCHEMA.md) — SwiftData models
- [Screens & Flows](docs/SCREENS.md) — All screens, user flows, wireframes

## Training Logic

All plan generation is in `TrainingPlanGenerator.swift`. Key rules:

- 80% easy / 20% hard intensity split
- Max weekly mileage increase: 5% (conservative) → 10% (aggressive)
- Every 4th week is a deload (80% of prior week volume)
- Long run = ~30% of weekly mileage, on user's preferred day
- No back-to-back hard workouts
- Beginner: no speed work for first 4 weeks
- Injury adjustments: shin splints cap increase at 5%, hamstrings skip intervals, knee/IT band avoid hills

## What's Not Included (v1)

- Apple Health integration
- Live run tracking
- Adaptive plan based on completed/skipped workouts (v2 hook exists in schema)
- Notifications
- Multiple profiles
