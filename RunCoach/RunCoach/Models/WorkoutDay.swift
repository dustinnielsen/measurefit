import Foundation
import SwiftData

@Model
final class WorkoutDay {
    var id: UUID
    var date: Date
    var weekNumber: Int
    var dayOfWeek: Int  // 0=Sun … 6=Sat

    var workoutTypeRaw: String
    var workoutType: WorkoutType {
        get { WorkoutType(rawValue: workoutTypeRaw) ?? .rest }
        set { workoutTypeRaw = newValue.rawValue }
    }

    var distanceMiles: Double?
    var durationMinutes: Int?
    var workoutDescription: String
    var coachingNotes: String
    var phaseRaw: String
    var phase: TrainingPhase {
        get { TrainingPhase(rawValue: phaseRaw) ?? .base }
        set { phaseRaw = newValue.rawValue }
    }

    // Completion tracking
    var isCompleted: Bool
    var isSkipped: Bool
    var completedAt: Date?
    var userNotes: String?

    // Adaptive plan fields — nil until the adaptation engine modifies this day
    var adaptationNote: String?        // non-nil = this day was changed; contains the reason
    var preAdaptTypeRaw: String?       // original WorkoutType before adaptation
    var preAdaptDistance: Double?      // original distance before adaptation

    var plan: TrainingPlan?

    init(
        date: Date,
        weekNumber: Int,
        dayOfWeek: Int,
        workoutType: WorkoutType,
        distanceMiles: Double? = nil,
        durationMinutes: Int? = nil,
        description: String,
        coachingNotes: String,
        phase: TrainingPhase
    ) {
        self.id = UUID()
        self.date = date
        self.weekNumber = weekNumber
        self.dayOfWeek = dayOfWeek
        self.workoutTypeRaw = workoutType.rawValue
        self.distanceMiles = distanceMiles
        self.durationMinutes = durationMinutes
        self.workoutDescription = description
        self.coachingNotes = coachingNotes
        self.phaseRaw = phase.rawValue
        self.isCompleted = false
        self.isSkipped = false
    }

    var wasAdapted: Bool { adaptationNote != nil }

    var preAdaptType: WorkoutType? {
        preAdaptTypeRaw.flatMap { WorkoutType(rawValue: $0) }
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }

    var isPast: Bool {
        date < Calendar.current.startOfDay(for: Date())
    }

    var summaryLine: String {
        if let miles = distanceMiles {
            return String(format: "%.1f mi", miles)
        } else if let mins = durationMinutes {
            return "\(mins) min"
        } else {
            return workoutType.label
        }
    }
}
