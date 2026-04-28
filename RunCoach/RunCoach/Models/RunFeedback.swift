import Foundation
import SwiftData

// MARK: - Model

@Model
final class RunFeedback {
    var id: UUID
    var recordedAt: Date

    var completionStatusRaw: String
    var effortRating: Int          // 1–10
    var painLevelRaw: String
    var energyLevelRaw: String
    var sleepQualityRaw: String

    var workoutDay: WorkoutDay?

    init(
        workoutDay: WorkoutDay,
        completionStatus: CompletionStatus,
        effortRating: Int,
        painLevel: PainLevel,
        energyLevel: EnergyLevel,
        sleepQuality: SleepQuality
    ) {
        self.id = UUID()
        self.recordedAt = Date()
        self.workoutDay = workoutDay
        self.completionStatusRaw = completionStatus.rawValue
        self.effortRating = max(1, min(10, effortRating))
        self.painLevelRaw = painLevel.rawValue
        self.energyLevelRaw = energyLevel.rawValue
        self.sleepQualityRaw = sleepQuality.rawValue
    }

    var completionStatus: CompletionStatus {
        CompletionStatus(rawValue: completionStatusRaw) ?? .completed
    }
    var painLevel: PainLevel {
        PainLevel(rawValue: painLevelRaw) ?? .none
    }
    var energyLevel: EnergyLevel {
        EnergyLevel(rawValue: energyLevelRaw) ?? .normal
    }
    var sleepQuality: SleepQuality {
        SleepQuality(rawValue: sleepQualityRaw) ?? .ok
    }

    /// Whether this feedback came from an easy run (used for fatigue analysis).
    var wasEasyRun: Bool {
        workoutDay?.workoutType == .easy
    }
    /// Whether this feedback came from a quality session.
    var wasHardRun: Bool {
        workoutDay?.workoutType == .tempo || workoutDay?.workoutType == .intervals
    }
}

// MARK: - Feedback Enums

enum CompletionStatus: String, CaseIterable {
    case completed, partial, skipped

    var label: String {
        switch self {
        case .completed: return "Yes"
        case .partial:   return "Partial"
        case .skipped:   return "No"
        }
    }

    var icon: String {
        switch self {
        case .completed: return "checkmark"
        case .partial:   return "minus"
        case .skipped:   return "xmark"
        }
    }

    /// Numeric weight for completion rate calculations.
    var weight: Double {
        switch self {
        case .completed: return 1.0
        case .partial:   return 0.5
        case .skipped:   return 0.0
        }
    }
}

enum PainLevel: String, CaseIterable {
    case none, mild, moderate, sharp

    var label: String {
        switch self {
        case .none:     return "None"
        case .mild:     return "Mild"
        case .moderate: return "Moderate"
        case .sharp:    return "Sharp"
        }
    }

    var icon: String {
        switch self {
        case .none:     return "checkmark.circle"
        case .mild:     return "exclamationmark.circle"
        case .moderate: return "exclamationmark.triangle"
        case .sharp:    return "xmark.octagon"
        }
    }

    var color: String {
        switch self {
        case .none:     return "gray"
        case .mild:     return "yellow"
        case .moderate: return "orange"
        case .sharp:    return "red"
        }
    }

    private var rank: Int {
        switch self { case .none: return 0; case .mild: return 1; case .moderate: return 2; case .sharp: return 3 }
    }
    static func < (lhs: PainLevel, rhs: PainLevel) -> Bool { lhs.rank < rhs.rank }
}
extension PainLevel: Comparable {}

enum EnergyLevel: String, CaseIterable {
    case low, normal, high

    var label: String {
        switch self {
        case .low:    return "Low"
        case .normal: return "Normal"
        case .high:   return "High"
        }
    }

    var icon: String {
        switch self {
        case .low:    return "battery.25"
        case .normal: return "battery.50"
        case .high:   return "battery.100"
        }
    }
}

enum SleepQuality: String, CaseIterable {
    case poor, ok, good

    var label: String {
        switch self {
        case .poor: return "Poor"
        case .ok:   return "OK"
        case .good: return "Good"
        }
    }

    var icon: String {
        switch self {
        case .poor: return "moon.zzz"
        case .ok:   return "moon"
        case .good: return "moon.stars"
        }
    }
}
