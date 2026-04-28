import Foundation
import SwiftData

@Observable
final class CheckInViewModel {

    // MARK: - Check-in form state

    var completionStatus: CompletionStatus = .completed
    var effortRating: Int = 5
    var painLevel: PainLevel = .none
    var energyLevel: EnergyLevel = .normal
    var sleepQuality: SleepQuality = .ok

    // MARK: - Phase management

    enum Phase { case form, processing, result }
    var phase: Phase = .form

    // MARK: - Result

    var result: AdaptationResult?

    // MARK: - Submission

    func submit(
        workout: WorkoutDay,
        experienceLevel: ExperienceLevel,
        modelContext: ModelContext
    ) {
        phase = .processing

        // 1. Update workout status based on completion.
        switch completionStatus {
        case .completed:
            workout.isCompleted = true
            workout.isSkipped = false
            workout.completedAt = Date()
        case .partial:
            workout.isCompleted = true   // counts as done for streaks
            workout.isSkipped = false
            workout.completedAt = Date()
        case .skipped:
            workout.isCompleted = false
            workout.isSkipped = true
        }

        // 2. Save feedback record.
        let feedback = RunFeedback(
            workoutDay: workout,
            completionStatus: completionStatus,
            effortRating: effortRating,
            painLevel: painLevel,
            energyLevel: energyLevel,
            sleepQuality: sleepQuality
        )
        modelContext.insert(feedback)

        // 3. Fetch recent feedback (last 7 days).
        let sevenDaysAgo = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        let recentFeedback: [RunFeedback] = (try? modelContext.fetch(
            FetchDescriptor<RunFeedback>(
                predicate: #Predicate { $0.recordedAt >= sevenDaysAgo },
                sortBy: [SortDescriptor(\.recordedAt, order: .reverse)]
            )
        )) ?? []

        // 4. Fetch the next 7 days of workouts (starting tomorrow, not today).
        let tomorrow = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        let sevenDaysOut = Calendar.current.date(byAdding: .day, value: 7, to: tomorrow)!
        let upcoming: [WorkoutDay] = (try? modelContext.fetch(
            FetchDescriptor<WorkoutDay>(
                predicate: #Predicate { $0.date >= tomorrow && $0.date <= sevenDaysOut && !$0.isCompleted && !$0.isSkipped },
                sortBy: [SortDescriptor(\.date)]
            )
        )) ?? []

        // 5. Run the engine.
        let adaptationResult = AdaptationEngine.analyze(
            recentFeedback: recentFeedback,
            upcomingWorkouts: upcoming,
            experienceLevel: experienceLevel
        )

        // 6. Apply adjustments to SwiftData objects.
        if !adaptationResult.adjustments.isEmpty {
            AdaptationEngine.apply(adaptationResult.adjustments, to: upcoming)
        }

        try? modelContext.save()
        result = adaptationResult
        phase = .result
    }

    // MARK: - Helpers

    var effortLabel: String {
        switch effortRating {
        case 1...3: return "Easy"
        case 4...5: return "Comfortable"
        case 6...7: return "Moderate"
        case 8...9: return "Hard"
        case 10:    return "Max effort"
        default:    return ""
        }
    }

    var effortSubtitle: String {
        switch effortRating {
        case 1...3: return "Could have gone much further"
        case 4...5: return "Felt controlled throughout"
        case 6...7: return "Working but sustainable"
        case 8...9: return "Pushing close to the limit"
        case 10:    return "Could not have gone harder"
        default:    return ""
        }
    }
}
