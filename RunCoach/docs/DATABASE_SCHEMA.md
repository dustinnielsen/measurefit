# RunCoach — Database Schema (SwiftData)

All models use SwiftData `@Model` macro. Storage is SQLite via SwiftData's default container. No migrations needed in v1 (schema is stable at launch).

---

## UserProfile

One record per device. Created during onboarding.

```swift
@Model class UserProfile {
    var id: UUID
    var createdAt: Date
    var updatedAt: Date

    // Demographics
    var age: Int
    var ability: RunningAbility         // beginner | intermediate | advanced

    // Current fitness
    var currentWeeklyMileage: Double    // miles/week
    var longestRecentRun: Double        // miles

    // Goal
    var goal: RunningGoal               // enum
    var goalDate: Date?                 // optional race/goal date

    // Schedule
    var runningDaysPerWeek: Int         // 2–7
    var preferredLongRunDay: Weekday    // 0=Sun … 6=Sat
    var strengthDaysPerWeek: Int        // 0–3

    // Preferences
    var trainingStyle: TrainingStyle    // conservative | balanced | aggressive

    // Injury history
    var injuries: [InjuryType]         // stored as [String] raw values

    // Relationship
    @Relationship(deleteRule: .cascade)
    var activePlan: TrainingPlan?
}
```

---

## TrainingPlan

One active plan per user. Contains all weeks.

```swift
@Model class TrainingPlan {
    var id: UUID
    var generatedAt: Date
    var startDate: Date                 // Monday of week 1
    var totalWeeks: Int
    var peakWeeklyMileage: Double

    // Relationship
    var userProfile: UserProfile?

    @Relationship(deleteRule: .cascade)
    var workoutDays: [WorkoutDay]
}
```

Computed helpers (not stored):
- `currentWeek` — Int, derived from `startDate` vs today
- `workoutsForWeek(_ n: Int)` — [WorkoutDay] filtered by week number

---

## WorkoutDay

One record per calendar day in the plan.

```swift
@Model class WorkoutDay {
    var id: UUID
    var date: Date                      // the calendar date
    var weekNumber: Int                 // 1-indexed week within the plan
    var dayOfWeek: Int                  // 0=Sun … 6=Sat

    // Workout definition
    var workoutType: WorkoutType        // easy | long | tempo | intervals | rest | strength | mobility
    var distanceMiles: Double?          // nil for rest/strength/mobility
    var durationMinutes: Int?           // nil unless it's a time-based workout
    var description: String             // human-readable instruction
    var coachingNotes: String           // "why" explanation for the workout

    // Completion tracking
    var isCompleted: Bool
    var isSkipped: Bool
    var completedAt: Date?
    var userNotes: String?              // runner's own notes

    // Relationship
    var plan: TrainingPlan?
}
```

---

## Enums (stored as raw String values)

```
RunningAbility:  beginner | intermediate | advanced
RunningGoal:     getFit | loseWeight | fiveK | tenK | halfMarathon | marathon | fasterMile
TrainingStyle:   conservative | balanced | aggressive
WorkoutType:     easy | long | tempo | intervals | strides | rest | strength | mobility
InjuryType:      none | knee | itBand | shinSplints | plantarFasciitis | hip | back | hamstring | other
Weekday:         0–6 (Int, Sunday = 0)
```

---

## Relationships Diagram

```
UserProfile (1) ──── (0..1) TrainingPlan
                              │
                    (1) ──── (*) WorkoutDay
```

---

## Notes

- SwiftData stores arrays of primitives (e.g. `[String]`) natively in SQLite as JSON blobs.
- `injuries` is `[String]` (raw values of `InjuryType`) to avoid needing a join table.
- When a plan is regenerated, the old `TrainingPlan` (and its cascade-deleted `WorkoutDay` records) is deleted first, then the new plan is inserted.
- `WorkoutDay.date` is the authoritative calendar date; `weekNumber` is a denormalized convenience for queries like "give me week 3."
