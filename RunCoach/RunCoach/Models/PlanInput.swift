import Foundation

/// All inputs the generator needs. Pure value type — no SwiftData dependency.
struct PlanInput: Codable, Equatable {
    let currentWeeklyMileage: Double   // miles/week right now
    let longestRecentRun: Double       // miles, within last 4 weeks
    let goalDistance: GoalDistance
    let goalTimelineWeeks: Int         // weeks until goal (4–20)
    let daysPerWeek: Int               // 3, 4, or 5 (clamped on init)
    let preferredLongRunDay: Int       // 0=Sun … 6=Sat
    let experienceLevel: ExperienceLevel
    let injuryRisk: InjuryRisk

    init(
        currentWeeklyMileage: Double,
        longestRecentRun: Double,
        goalDistance: GoalDistance,
        goalTimelineWeeks: Int,
        daysPerWeek: Int,
        preferredLongRunDay: Int,
        experienceLevel: ExperienceLevel,
        injuryRisk: InjuryRisk
    ) {
        self.currentWeeklyMileage = max(0, currentWeeklyMileage)
        self.longestRecentRun = max(0, longestRecentRun)
        self.goalDistance = goalDistance
        self.goalTimelineWeeks = max(4, min(20, goalTimelineWeeks))
        self.daysPerWeek = max(3, min(5, daysPerWeek))
        self.preferredLongRunDay = max(0, min(6, preferredLongRunDay))
        self.experienceLevel = experienceLevel
        self.injuryRisk = injuryRisk
    }
}

// MARK: - Input Enums

enum GoalDistance: String, Codable, CaseIterable {
    case fitness, fiveK, tenK, halfMarathon, marathon, fasterMile

    var label: String {
        switch self {
        case .fitness:      return "General Fitness"
        case .fiveK:        return "5K"
        case .tenK:         return "10K"
        case .halfMarathon: return "Half Marathon"
        case .marathon:     return "Marathon"
        case .fasterMile:   return "Faster Mile"
        }
    }

    /// Ideal peak weekly mileage range for this goal.
    var peakMileageRange: ClosedRange<Double> {
        switch self {
        case .fitness:      return 20...30
        case .fiveK:        return 25...35
        case .tenK:         return 30...40
        case .halfMarathon: return 35...50
        case .marathon:     return 45...60
        case .fasterMile:   return 25...35
        }
    }

    /// Hard ceiling on the long run distance.
    var maxLongRunMiles: Double {
        switch self {
        case .fitness:      return 12
        case .fiveK:        return 10
        case .tenK:         return 13
        case .halfMarathon: return 16
        case .marathon:     return 22
        case .fasterMile:   return 10
        }
    }

    /// Whether the plan should include a taper at the end.
    var needsTaper: Bool { self != .fitness }
}

enum ExperienceLevel: String, Codable, CaseIterable {
    case beginner, intermediate, advanced

    var label: String {
        switch self {
        case .beginner:     return "Beginner"
        case .intermediate: return "Intermediate"
        case .advanced:     return "Advanced"
        }
    }

    /// Whether this level uses pace/heart-rate zones rather than effort-only cues.
    var usesPaceZones: Bool { self != .beginner }
}

enum InjuryRisk: String, Codable, CaseIterable {
    case low, medium, high

    var label: String {
        switch self {
        case .low:    return "Low"
        case .medium: return "Medium"
        case .high:   return "High"
        }
    }

    /// Maximum allowed week-over-week mileage increase, adjusted for injury risk.
    func maxWeeklyIncrease(base: Double) -> Double {
        switch self {
        case .low:    return base * 1.10
        case .medium: return base * 1.07
        case .high:   return base * 1.05
        }
    }
}
