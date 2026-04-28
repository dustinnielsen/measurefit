import XCTest
@testable import RunCoach

final class AdaptationEngineTests: XCTestCase {

    // MARK: - Helpers

    private func makeFeedback(
        effort: Int = 5,
        pain: PainLevel = .none,
        energy: EnergyLevel = .normal,
        sleep: SleepQuality = .ok,
        completion: CompletionStatus = .completed,
        daysAgo: Int = 0,
        workoutType: WorkoutType = .easy
    ) -> RunFeedback {
        // RunFeedback is a SwiftData @Model so we can't create it without a context.
        // Instead, test through the signal-analysis logic directly.
        // These tests use the non-SwiftData-dependent path via extension below.
        fatalError("Use makeMockFeedback instead")
    }

    // MARK: - Signal computation tests
    // (Testing the engine through its public analyze() method using test doubles.)

    func test_sharpPainTriggersDanger() {
        let signals = AdaptationSignals(
            worstPain: .sharp,
            fatigue: .normal,
            performance: .normal,
            completionRate: 1.0
        )
        let level = AdaptationEngine.testLevel(signals: signals)
        XCTAssertEqual(level, .danger)
    }

    func test_moderatePainTriggersConcern() {
        let signals = AdaptationSignals(
            worstPain: .moderate,
            fatigue: .normal,
            performance: .normal,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .concern)
    }

    func test_mildPainAloneTriggersCaution() {
        let signals = AdaptationSignals(
            worstPain: .mild,
            fatigue: .normal,
            performance: .normal,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .caution)
    }

    func test_mildPainPlusHighFatigueTriggersConcern() {
        let signals = AdaptationSignals(
            worstPain: .mild,
            fatigue: .high,
            performance: .normal,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .concern)
    }

    func test_highFatigueAloneTriggersConcern() {
        let signals = AdaptationSignals(
            worstPain: .none,
            fatigue: .high,
            performance: .normal,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .concern)
    }

    func test_tiredFatigueTriggersCaution() {
        let signals = AdaptationSignals(
            worstPain: .none,
            fatigue: .tired,
            performance: .normal,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .caution)
    }

    func test_lowCompletionRateTriggersCaution() {
        let signals = AdaptationSignals(
            worstPain: .none,
            fatigue: .normal,
            performance: .normal,
            completionRate: 0.3
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .caution)
    }

    func test_allGoodSignalsTriggersOk() {
        let signals = AdaptationSignals(
            worstPain: .none,
            fatigue: .fresh,
            performance: .strong,
            completionRate: 1.0
        )
        XCTAssertEqual(AdaptationEngine.testLevel(signals: signals), .ok)
    }

    // MARK: - Adjustment generation tests

    func test_dangerRemovesAllQualityWorkouts() {
        let upcoming = makeUpcomingWorkouts(types: [.easy, .intervals, .long, .tempo, .easy])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .danger,
            signals: AdaptationSignals(worstPain: .sharp, fatigue: .normal, performance: .normal, completionRate: 1.0),
            upcoming: upcoming
        )
        let adjustedIds = Set(adjustments.map(\.workoutDayId))
        let qualityWorkouts = upcoming.filter { $0.workoutType.isHard }
        for q in qualityWorkouts {
            XCTAssertTrue(adjustedIds.contains(q.id), "Quality workout \(q.workoutType) should be adjusted in danger")
        }
    }

    func test_dangerDowngradesQualityToEasy() {
        let upcoming = makeUpcomingWorkouts(types: [.intervals, .tempo])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .danger,
            signals: AdaptationSignals(worstPain: .sharp, fatigue: .normal, performance: .normal, completionRate: 1.0),
            upcoming: upcoming
        )
        for adj in adjustments where adj.originalType.isHard {
            XCTAssertEqual(adj.newType, .easy, "Danger should convert quality to easy, got \(adj.newType)")
        }
    }

    func test_dangerReducesLongRunDistance() {
        let longRun = makeWorkout(type: .long, distance: 12.0)
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .danger,
            signals: AdaptationSignals(worstPain: .sharp, fatigue: .normal, performance: .normal, completionRate: 1.0),
            upcoming: [longRun]
        )
        guard let adj = adjustments.first(where: { $0.workoutDayId == longRun.id }),
              let newDist = adj.newDistanceMiles else {
            XCTFail("Long run should have an adjustment with a new distance")
            return
        }
        XCTAssertLessThan(newDist, 12.0, "Danger should reduce long run distance")
        XCTAssertGreaterThanOrEqual(newDist, 12.0 * 0.65, "Danger should not cut long run by more than 35%")
    }

    func test_concernRemovesIntervalsAndTempo() {
        let upcoming = makeUpcomingWorkouts(types: [.intervals, .tempo, .easy, .long])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .concern,
            signals: AdaptationSignals(worstPain: .moderate, fatigue: .normal, performance: .normal, completionRate: 1.0),
            upcoming: upcoming
        )
        let adjustedIds = Set(adjustments.map(\.workoutDayId))
        let qualityIds = upcoming.filter { $0.workoutType.isHard }.map(\.id)
        for id in qualityIds {
            XCTAssertTrue(adjustedIds.contains(id), "Concern should adjust all quality sessions")
        }
    }

    func test_cautionDowngradesIntervalsToTempo() {
        let upcoming = makeUpcomingWorkouts(types: [.intervals, .easy])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .caution,
            signals: AdaptationSignals(worstPain: .mild, fatigue: .normal, performance: .normal, completionRate: 1.0),
            upcoming: upcoming
        )
        guard let adj = adjustments.first(where: { $0.originalType == .intervals }) else {
            XCTFail("Intervals should be adjusted under caution")
            return
        }
        XCTAssertEqual(adj.newType, .tempo, "Caution should downgrade intervals → tempo, got \(adj.newType)")
    }

    func test_cautionDoesNotTouchTempoOrLongRun() {
        let upcoming = makeUpcomingWorkouts(types: [.tempo, .long, .easy])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .caution,
            signals: AdaptationSignals(worstPain: .mild, fatigue: .tired, performance: .normal, completionRate: 1.0),
            upcoming: upcoming
        )
        let adjustedTypes = Set(adjustments.map(\.originalType))
        XCTAssertFalse(adjustedTypes.contains(.tempo), "Caution should NOT touch tempo sessions")
        XCTAssertFalse(adjustedTypes.contains(.long), "Caution should NOT touch long run")
    }

    func test_okSignalProducesNoAdjustments() {
        let upcoming = makeUpcomingWorkouts(types: [.easy, .tempo, .long])
        let adjustments = AdaptationEngine.testAdjustments(
            signalLevel: .ok,
            signals: AdaptationSignals(worstPain: .none, fatigue: .fresh, performance: .strong, completionRate: 1.0),
            upcoming: upcoming
        )
        XCTAssertTrue(adjustments.isEmpty, "OK signal should produce no adjustments")
    }

    func test_requiresMedicalAttentionOnlyForSharpPain() {
        let sharpSignals = AdaptationSignals(worstPain: .sharp, fatigue: .normal, performance: .normal, completionRate: 1.0)
        let modSignals = AdaptationSignals(worstPain: .moderate, fatigue: .normal, performance: .normal, completionRate: 1.0)
        let result1 = AdaptationEngine.testResult(signals: sharpSignals, upcoming: [])
        let result2 = AdaptationEngine.testResult(signals: modSignals, upcoming: [])
        XCTAssertTrue(result1.requiresMedicalAttention)
        XCTAssertFalse(result2.requiresMedicalAttention)
    }

    func test_neverIncreasesVolume() {
        // No adjustment should ever increase a workout's distance.
        let upcoming = makeUpcomingWorkouts(types: [.intervals, .tempo, .long, .easy])
        for level in [SignalLevel.caution, .concern, .danger] {
            let signals = AdaptationSignals(worstPain: .moderate, fatigue: .high, performance: .struggling, completionRate: 0.3)
            let adjustments = AdaptationEngine.testAdjustments(signalLevel: level, signals: signals, upcoming: upcoming)
            for adj in adjustments {
                if let newDist = adj.newDistanceMiles,
                   let origDist = upcoming.first(where: { $0.id == adj.workoutDayId })?.distanceMiles {
                    XCTAssertLessThanOrEqual(newDist, origDist + 0.01,
                        "\(level) adjusted \(adj.originalType) from \(origDist) to \(newDist) — never increase!")
                }
            }
        }
    }

    // MARK: - Helpers

    private func makeWorkout(type: WorkoutType, distance: Double? = 5.0) -> WorkoutDay {
        WorkoutDay(
            date: Calendar.current.date(byAdding: .day, value: 2, to: Date())!,
            weekNumber: 1, dayOfWeek: 2,
            workoutType: type,
            distanceMiles: distance,
            description: type.label,
            coachingNotes: "test",
            phase: .base
        )
    }

    private func makeUpcomingWorkouts(types: [WorkoutType]) -> [WorkoutDay] {
        types.enumerated().map { i, type in
            WorkoutDay(
                date: Calendar.current.date(byAdding: .day, value: i + 1, to: Date())!,
                weekNumber: 1, dayOfWeek: (i + 1) % 7,
                workoutType: type,
                distanceMiles: 5.0,
                description: type.label,
                coachingNotes: "test",
                phase: .base
            )
        }
    }
}

// Test hooks are defined in AdaptationEngine.swift to preserve private access.

// WorkoutType.isHard is defined in Enums.swift and available via @testable import.
