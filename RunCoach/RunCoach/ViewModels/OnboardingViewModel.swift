import Foundation
import SwiftData
import SwiftUI

@Observable
final class OnboardingViewModel {
    var currentStep = 0
    let totalSteps = 5

    // Step 1 — Basic Info
    var age: Double = 30
    var ability: RunningAbility = .beginner
    var weeklyMileage: Double = 10
    var longestRun: Double = 4

    // Step 2 — Goal
    var goal: RunningGoal = .getFit
    var hasGoalDate = false
    var goalDate: Date = Calendar.current.date(byAdding: .month, value: 4, to: Date()) ?? Date()

    // Step 3 — Schedule
    var runningDays: Double = 4
    var preferredLongRunDay: Int = 0  // Sunday
    var strengthDays: Double = 1

    // Step 4 — Injury
    var selectedInjuries: Set<InjuryType> = [.none]
    var injuryRisk: InjuryRisk = .low

    // Step 5 — Style
    var trainingStyle: TrainingStyle = .balanced

    // Generation state
    var isGenerating = false
    var generationComplete = false

    var progress: Double { Double(currentStep) / Double(totalSteps) }

    var canAdvance: Bool {
        switch currentStep {
        case 0: return age >= 13 && weeklyMileage >= 0 && longestRun >= 0
        default: return true
        }
    }

    func advance() {
        guard currentStep < totalSteps - 1 else { return }
        withAnimation { currentStep += 1 }
    }

    func back() {
        guard currentStep > 0 else { return }
        withAnimation { currentStep -= 1 }
    }

    func generatePlan(modelContext: ModelContext) {
        isGenerating = true

        let profile = UserProfile(
            age: Int(age),
            ability: ability,
            currentWeeklyMileage: weeklyMileage,
            longestRecentRun: longestRun,
            goal: goal,
            goalDate: hasGoalDate ? goalDate : nil,
            runningDaysPerWeek: Int(runningDays),
            preferredLongRunDay: preferredLongRunDay,
            strengthDaysPerWeek: Int(strengthDays),
            trainingStyle: trainingStyle,
            injuryRisk: injuryRisk,
            injuries: injuryList
        )

        modelContext.insert(profile)
        insertPlan(for: profile, modelContext: modelContext)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.isGenerating = false
            self.generationComplete = true
        }
    }

    private var injuryList: [InjuryType] {
        selectedInjuries.contains(.none) ? [] : Array(selectedInjuries)
    }
}

// MARK: - Shared plan insertion

func insertPlan(for profile: UserProfile, modelContext: ModelContext) {
    let generated = TrainingPlanGenerator.generate(input: profile.planInput)
    let (plan, workouts) = TrainingPlanGenerator.toSwiftDataObjects(from: generated)

    modelContext.insert(plan)
    for workout in workouts {
        modelContext.insert(workout)
        workout.plan = plan
    }
    plan.userProfile = profile
    profile.activePlan = plan

    try? modelContext.save()
}
