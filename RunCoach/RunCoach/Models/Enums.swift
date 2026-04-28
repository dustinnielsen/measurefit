import Foundation

enum RunningAbility: String, CaseIterable, Codable {
    case beginner, intermediate, advanced

    var label: String {
        switch self {
        case .beginner: return "Beginner"
        case .intermediate: return "Intermediate"
        case .advanced: return "Advanced"
        }
    }

    var description: String {
        switch self {
        case .beginner: return "Running less than 6 months or under 15 mi/week"
        case .intermediate: return "1–3 years of consistent running, 15–35 mi/week"
        case .advanced: return "3+ years, racing regularly, 35+ mi/week"
        }
    }
}

enum RunningGoal: String, CaseIterable, Codable {
    case getFit, loseWeight, fiveK, tenK, halfMarathon, marathon, fasterMile

    var label: String {
        switch self {
        case .getFit: return "Get Fit"
        case .loseWeight: return "Lose Weight"
        case .fiveK: return "Run a 5K"
        case .tenK: return "Run a 10K"
        case .halfMarathon: return "Half Marathon"
        case .marathon: return "Marathon"
        case .fasterMile: return "Faster Mile"
        }
    }

    var emoji: String {
        switch self {
        case .getFit: return "💪"
        case .loseWeight: return "⚖️"
        case .fiveK: return "🏁"
        case .tenK: return "🎽"
        case .halfMarathon: return "🏅"
        case .marathon: return "🏆"
        case .fasterMile: return "⚡️"
        }
    }

    var peakMileageRange: ClosedRange<Double> {
        switch self {
        case .getFit, .loseWeight: return 20...30
        case .fiveK: return 20...30
        case .tenK: return 25...35
        case .halfMarathon: return 35...45
        case .marathon: return 45...55
        case .fasterMile: return 20...30
        }
    }

    var hasRaceDistance: Bool {
        switch self {
        case .fiveK, .tenK, .halfMarathon, .marathon: return true
        default: return false
        }
    }
}

enum TrainingStyle: String, CaseIterable, Codable {
    case conservative, balanced, aggressive

    var label: String {
        switch self {
        case .conservative: return "Conservative"
        case .balanced: return "Balanced"
        case .aggressive: return "Aggressive"
        }
    }

    var description: String {
        switch self {
        case .conservative: return "Safety first. Slower progression, more rest. Best for injury-prone runners."
        case .balanced: return "Standard approach. Steady progress with adequate recovery."
        case .aggressive: return "Push your limits. Faster progression for experienced, healthy runners."
        }
    }

    var weeklyIncreasePercent: Double {
        switch self {
        case .conservative: return 0.05
        case .balanced: return 0.08
        case .aggressive: return 0.10
        }
    }
}

enum WorkoutType: String, CaseIterable, Codable {
    case easy, long, tempo, intervals, strides, rest, strength, mobility

    var label: String {
        switch self {
        case .easy: return "Easy Run"
        case .long: return "Long Run"
        case .tempo: return "Tempo Run"
        case .intervals: return "Intervals"
        case .strides: return "Easy + Strides"
        case .rest: return "Rest"
        case .strength: return "Strength"
        case .mobility: return "Mobility"
        }
    }

    var emoji: String {
        switch self {
        case .easy: return "🏃"
        case .long: return "🛣️"
        case .tempo: return "⏱️"
        case .intervals: return "⚡️"
        case .strides: return "💨"
        case .rest: return "😴"
        case .strength: return "🏋️"
        case .mobility: return "🧘"
        }
    }

    var isHard: Bool {
        self == .tempo || self == .intervals
    }

    var isRun: Bool {
        self == .easy || self == .long || self == .tempo || self == .intervals || self == .strides
    }

    var color: String {
        switch self {
        case .easy: return "green"
        case .long: return "blue"
        case .tempo: return "orange"
        case .intervals: return "red"
        case .strides: return "teal"
        case .rest: return "gray"
        case .strength: return "purple"
        case .mobility: return "mint"
        }
    }
}

enum InjuryType: String, CaseIterable, Codable {
    case none, knee, itBand, shinSplints, plantarFasciitis, hip, back, hamstring, other

    var label: String {
        switch self {
        case .none: return "None"
        case .knee: return "Knee"
        case .itBand: return "IT Band"
        case .shinSplints: return "Shin Splints"
        case .plantarFasciitis: return "Plantar Fasciitis"
        case .hip: return "Hip"
        case .back: return "Back"
        case .hamstring: return "Hamstring"
        case .other: return "Other"
        }
    }
}

enum TrainingPhase: String, Codable {
    case base, build, peak, taper, deload

    var label: String {
        switch self {
        case .base: return "Base"
        case .build: return "Build"
        case .peak: return "Peak"
        case .taper: return "Taper"
        case .deload: return "Recovery"
        }
    }

    var description: String {
        switch self {
        case .base: return "Building your aerobic engine with easy miles"
        case .build: return "Adding quality workouts and increasing mileage"
        case .peak: return "Your highest volume and intensity weeks"
        case .taper: return "Reducing load so you arrive fresh on race day"
        case .deload: return "Easy recovery week to absorb training stress"
        }
    }
}
