import Foundation

// MARK: - Top-level output

/// A complete multi-week training plan. JSON-serializable.
struct GeneratedPlan: Codable {
    let input: PlanInput
    let generatedAt: String           // ISO 8601
    let startDate: String             // ISO 8601 — always a Monday
    let totalWeeks: Int
    let peakWeeklyMiles: Double
    let weeks: [WeekPlan]
}

// MARK: - Week

struct WeekPlan: Codable {
    let weekNumber: Int
    let phase: PlanPhase
    let targetMiles: Double
    let isDeload: Bool
    let days: [DayPlan]              // always 7 elements, Mon–Sun

    var totalRunMiles: Double {
        days.compactMap(\.distanceMiles).reduce(0, +)
    }
}

enum PlanPhase: String, Codable {
    case base, build, peak, taper, deload

    var label: String {
        switch self {
        case .base:   return "Base"
        case .build:  return "Build"
        case .peak:   return "Peak"
        case .taper:  return "Taper"
        case .deload: return "Recovery"
        }
    }

    var description: String {
        switch self {
        case .base:   return "Building your aerobic engine with consistent easy miles"
        case .build:  return "Adding quality work and increasing weekly volume"
        case .peak:   return "Highest training load — trust the process"
        case .taper:  return "Reducing volume so you arrive fresh and sharp"
        case .deload: return "Planned recovery week to absorb training stress"
        }
    }
}

// MARK: - Day

struct DayPlan: Codable {
    let date: String                  // ISO 8601
    let dayName: String               // "Monday", "Tuesday", …
    let workoutType: DayWorkoutType
    let title: String                 // "Easy Run — 5.0 mi"
    let distanceMiles: Double?
    let durationMinutes: Int?
    let effortGuidance: EffortGuidance?
    let workoutStructure: WorkoutStructure?
    let coachingNote: String
}

enum DayWorkoutType: String, Codable {
    case easy, long, tempo, intervals, rest, strength, mobility

    var emoji: String {
        switch self {
        case .easy:      return "🏃"
        case .long:      return "🛣️"
        case .tempo:     return "⏱️"
        case .intervals: return "⚡️"
        case .rest:      return "😴"
        case .strength:  return "🏋️"
        case .mobility:  return "🧘"
        }
    }

    var isHardRun: Bool { self == .tempo || self == .intervals }
    var isRun: Bool { self != .rest && self != .strength && self != .mobility }
}

// MARK: - Effort guidance

/// How hard the workout should feel. Nil for beginners on easy/long runs.
struct EffortGuidance: Codable {
    let zone: String           // "Zone 2", "Zone 3–4", "Zone 4–5"
    let rpe: String            // "4–5 / 10"
    let heartRateZone: String  // "65–75% max HR"
    let feel: String           // "Conversational — full sentences throughout"
}

extension EffortGuidance {
    static let zone2 = EffortGuidance(
        zone: "Zone 2",
        rpe: "4–5 / 10",
        heartRateZone: "65–75% max HR",
        feel: "Conversational — you can speak in full sentences throughout"
    )

    static let zone3_4 = EffortGuidance(
        zone: "Zone 3–4",
        rpe: "7–8 / 10",
        heartRateZone: "80–90% max HR",
        feel: "Comfortably hard — words, not sentences"
    )

    static let zone4_5 = EffortGuidance(
        zone: "Zone 4–5",
        rpe: "9–10 / 10",
        heartRateZone: "90–100% max HR",
        feel: "Hard and controlled — brief efforts, not a death march"
    )
}

// MARK: - Workout structure

struct WorkoutStructure: Codable {
    let warmup: String?    // "1.0 mi easy warm-up"
    let mainSet: String    // "3.5 mi at tempo effort" or "6 × 400 m with 90 sec jog recovery"
    let cooldown: String?  // "1.0 mi easy cool-down"
}

// MARK: - Interval prescription

struct IntervalPrescription {
    let reps: Int
    let repDistance: Int      // meters
    let repPace: String       // "5K effort" or "10K effort"
    let recovery: String      // "90 sec jog"
    let totalApproxMiles: Double
}
