import Foundation
import SwiftData

@Model
final class UserProfile {
    var id: UUID
    var createdAt: Date
    var updatedAt: Date

    // Demographics
    var age: Int
    var abilityRaw: String
    var ability: RunningAbility {
        get { RunningAbility(rawValue: abilityRaw) ?? .beginner }
        set { abilityRaw = newValue.rawValue }
    }

    // Current fitness
    var currentWeeklyMileage: Double
    var longestRecentRun: Double

    // Goal
    var goalRaw: String
    var goal: RunningGoal {
        get { RunningGoal(rawValue: goalRaw) ?? .getFit }
        set { goalRaw = newValue.rawValue }
    }
    var goalDate: Date?

    // Schedule
    var runningDaysPerWeek: Int
    var preferredLongRunDay: Int  // 0=Sun, 1=Mon, … 6=Sat
    var strengthDaysPerWeek: Int

    // Preferences
    var trainingStyleRaw: String
    var trainingStyle: TrainingStyle {
        get { TrainingStyle(rawValue: trainingStyleRaw) ?? .balanced }
        set { trainingStyleRaw = newValue.rawValue }
    }

    var injuryRiskRaw: String
    var injuryRisk: InjuryRisk {
        get { InjuryRisk(rawValue: injuryRiskRaw) ?? .low }
        set { injuryRiskRaw = newValue.rawValue }
    }

    // Injury history (stored as comma-separated raw values)
    var injuriesRaw: String
    var injuries: [InjuryType] {
        get {
            injuriesRaw.split(separator: ",")
                .compactMap { InjuryType(rawValue: String($0)) }
        }
        set {
            injuriesRaw = newValue.map(\.rawValue).joined(separator: ",")
        }
    }

    @Relationship(deleteRule: .cascade)
    var activePlan: TrainingPlan?

    init(
        age: Int = 30,
        ability: RunningAbility = .beginner,
        currentWeeklyMileage: Double = 10,
        longestRecentRun: Double = 4,
        goal: RunningGoal = .getFit,
        goalDate: Date? = nil,
        runningDaysPerWeek: Int = 4,
        preferredLongRunDay: Int = 0,
        strengthDaysPerWeek: Int = 1,
        trainingStyle: TrainingStyle = .balanced,
        injuryRisk: InjuryRisk = .low,
        injuries: [InjuryType] = []
    ) {
        self.id = UUID()
        self.createdAt = Date()
        self.updatedAt = Date()
        self.age = age
        self.abilityRaw = ability.rawValue
        self.currentWeeklyMileage = currentWeeklyMileage
        self.longestRecentRun = longestRecentRun
        self.goalRaw = goal.rawValue
        self.goalDate = goalDate
        self.runningDaysPerWeek = runningDaysPerWeek
        self.preferredLongRunDay = preferredLongRunDay
        self.strengthDaysPerWeek = strengthDaysPerWeek
        self.trainingStyleRaw = trainingStyle.rawValue
        self.injuryRiskRaw = injuryRisk.rawValue
        self.injuriesRaw = injuries.map(\.rawValue).joined(separator: ",")
    }
}

// MARK: - PlanInput bridge

extension UserProfile {

    /// Converts this profile into the generator's input type.
    var planInput: PlanInput {
        let goalDistance: GoalDistance
        switch goal {
        case .getFit, .loseWeight: goalDistance = .fitness
        case .fiveK:               goalDistance = .fiveK
        case .tenK:                goalDistance = .tenK
        case .halfMarathon:        goalDistance = .halfMarathon
        case .marathon:            goalDistance = .marathon
        case .fasterMile:          goalDistance = .fasterMile
        }

        let experience: ExperienceLevel
        switch ability {
        case .beginner:     experience = .beginner
        case .intermediate: experience = .intermediate
        case .advanced:     experience = .advanced
        }

        let weeksToGoal: Int
        if let goalDate {
            let weeks = Calendar.current.dateComponents([.weekOfYear], from: Date(), to: goalDate).weekOfYear ?? 8
            weeksToGoal = max(4, min(20, weeks))
        } else {
            weeksToGoal = 8
        }

        // Clamp daysPerWeek to 3–5 (generator only handles this range).
        let days = max(3, min(5, runningDaysPerWeek))

        return PlanInput(
            currentWeeklyMileage: currentWeeklyMileage,
            longestRecentRun: longestRecentRun,
            goalDistance: goalDistance,
            goalTimelineWeeks: weeksToGoal,
            daysPerWeek: days,
            preferredLongRunDay: preferredLongRunDay,
            experienceLevel: experience,
            injuryRisk: injuryRisk
        )
    }
}
