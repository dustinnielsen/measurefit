import Foundation
import SwiftData

@Model
final class TrainingPlan {
    var id: UUID
    var generatedAt: Date
    var startDate: Date
    var totalWeeks: Int
    var peakWeeklyMileage: Double

    var userProfile: UserProfile?

    @Relationship(deleteRule: .cascade)
    var workoutDays: [WorkoutDay]

    init(startDate: Date, totalWeeks: Int, peakWeeklyMileage: Double) {
        self.id = UUID()
        self.generatedAt = Date()
        self.startDate = startDate
        self.totalWeeks = totalWeeks
        self.peakWeeklyMileage = peakWeeklyMileage
        self.workoutDays = []
    }

    func workouts(forWeek week: Int) -> [WorkoutDay] {
        workoutDays
            .filter { $0.weekNumber == week }
            .sorted { $0.dayOfWeek < $1.dayOfWeek }
    }

    func weeklyMileage(forWeek week: Int) -> Double {
        workouts(forWeek: week)
            .compactMap(\.distanceMiles)
            .reduce(0, +)
    }

    var currentWeekNumber: Int {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let start = cal.startOfDay(for: startDate)
        let days = cal.dateComponents([.day], from: start, to: today).day ?? 0
        return max(1, min(totalWeeks, (days / 7) + 1))
    }

    var currentWeekWorkouts: [WorkoutDay] {
        workouts(forWeek: currentWeekNumber)
    }

    var todayWorkout: WorkoutDay? {
        workoutDays.first { $0.isToday }
    }

    var completedMilesThisWeek: Double {
        currentWeekWorkouts
            .filter(\.isCompleted)
            .compactMap(\.distanceMiles)
            .reduce(0, +)
    }

    var targetMilesThisWeek: Double {
        weeklyMileage(forWeek: currentWeekNumber)
    }
}
