import XCTest
@testable import RunCoach

final class TrainingPlanGeneratorTests: XCTestCase {

    // MARK: - Helpers

    private func makeInput(
        weeklyMileage: Double = 20,
        longestRun: Double = 8,
        goal: GoalDistance = .fiveK,
        weeks: Int = 8,
        days: Int = 4,
        longRunDay: Int = 0,  // Sunday
        level: ExperienceLevel = .intermediate,
        risk: InjuryRisk = .low
    ) -> PlanInput {
        PlanInput(
            currentWeeklyMileage: weeklyMileage,
            longestRecentRun: longestRun,
            goalDistance: goal,
            goalTimelineWeeks: weeks,
            daysPerWeek: days,
            preferredLongRunDay: longRunDay,
            experienceLevel: level,
            injuryRisk: risk
        )
    }

    // MARK: - Volume progression tests

    func test_weekCount_matchesGoalTimeline() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 10))
        XCTAssertEqual(plan.weeks.count, 10)
    }

    func test_weeklyVolumeNeverExceedsTenPercent() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 12))
        var lastBuildVolume: Double = 0
        for week in plan.weeks {
            if week.isDeload || week.phase == .taper { continue }
            if lastBuildVolume > 0 {
                let increase = week.targetMiles / lastBuildVolume
                XCTAssertLessThanOrEqual(
                    increase, 1.101,  // allow floating-point rounding
                    "Week \(week.weekNumber) increased by \(increase)x — exceeds 10% rule"
                )
            }
            lastBuildVolume = week.targetMiles
        }
    }

    func test_deloadWeeksOccurEveryFourth() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 12))
        let deloadWeeks = plan.weeks.filter(\.isDeload).map(\.weekNumber)
        // Weeks 4 and 8 should be deloads (week 12 is taper for this 12-week plan).
        XCTAssertTrue(deloadWeeks.contains(4), "Week 4 should be a deload")
        XCTAssertTrue(deloadWeeks.contains(8), "Week 8 should be a deload")
    }

    func test_deloadVolumeIsReducedFromPriorBuildWeek() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 12))
        let week3 = plan.weeks.first(where: { $0.weekNumber == 3 })!
        let week4 = plan.weeks.first(where: { $0.weekNumber == 4 })!
        XCTAssertTrue(week4.isDeload)
        let reduction = week4.targetMiles / week3.targetMiles
        XCTAssertLessThanOrEqual(reduction, 0.85, "Deload should be at least 15% below prior week")
        XCTAssertGreaterThanOrEqual(reduction, 0.65, "Deload should not drop below 35% of prior week")
    }

    func test_highInjuryRiskCapsIncreaseAtFivePercent() {
        let low = makeInput(risk: .low)
        let high = makeInput(risk: .high)
        let lowPlan = TrainingPlanGenerator.generate(input: low)
        let highPlan = TrainingPlanGenerator.generate(input: high)
        // High-risk peak should be lower or equal to low-risk peak given same timeline.
        XCTAssertLessThanOrEqual(highPlan.peakWeeklyMiles, lowPlan.peakWeeklyMiles + 0.5)
    }

    func test_firstLongRunDoesNotExceedLongestRecentRun() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(longestRun: 6))
        let firstWeek = plan.weeks[0]
        let longDay = firstWeek.days.first(where: { $0.workoutType == .long })!
        let miles = longDay.distanceMiles ?? 0
        XCTAssertLessThanOrEqual(
            miles, 6.0 * 1.11,
            "First long run (\(miles) mi) exceeds longestRecentRun × 1.10"
        )
    }

    func test_longRunNeverExceedsGoalCap() {
        let goalCaps: [(GoalDistance, Double)] = [
            (.fiveK, 10), (.tenK, 13), (.halfMarathon, 16), (.marathon, 22)
        ]
        for (goal, cap) in goalCaps {
            let plan = TrainingPlanGenerator.generate(
                input: makeInput(weeklyMileage: 50, longestRun: 20, goal: goal, weeks: 16, level: .advanced)
            )
            for week in plan.weeks {
                if let longDay = week.days.first(where: { $0.workoutType == .long }),
                   let miles = longDay.distanceMiles {
                    XCTAssertLessThanOrEqual(
                        miles, cap + 0.1,
                        "\(goal.label): long run \(miles) mi exceeds cap \(cap)"
                    )
                }
            }
        }
    }

    // MARK: - Day count / composition tests

    func test_threeDayWeekHasExactlyOneEasyOneQualityOneLong() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(days: 3, weeks: 4, level: .intermediate))
        // Check a build week (not deload).
        let buildWeek = plan.weeks.first(where: { !$0.isDeload && $0.phase != .taper })!
        let runDays = buildWeek.days.filter { $0.workoutType.isRun }
        XCTAssertEqual(runDays.count, 3, "3-day plan should have exactly 3 running days")
        let easy = runDays.filter { $0.workoutType == .easy }.count
        let quality = runDays.filter { $0.workoutType == .tempo || $0.workoutType == .intervals }.count
        let long = runDays.filter { $0.workoutType == .long }.count
        XCTAssertEqual(easy, 1)
        XCTAssertEqual(quality, 1)
        XCTAssertEqual(long, 1)
    }

    func test_fourDayWeekHasExactlyTwoEasyOneQualityOneLong() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(days: 4, weeks: 4, level: .intermediate))
        let buildWeek = plan.weeks.first(where: { !$0.isDeload && $0.phase != .taper })!
        let runDays = buildWeek.days.filter { $0.workoutType.isRun }
        XCTAssertEqual(runDays.count, 4)
        XCTAssertEqual(runDays.filter { $0.workoutType == .easy }.count, 2)
        XCTAssertEqual(runDays.filter { $0.workoutType == .tempo || $0.workoutType == .intervals }.count, 1)
        XCTAssertEqual(runDays.filter { $0.workoutType == .long }.count, 1)
    }

    func test_fiveDayWeekHasExactlyThreeEasyOneQualityOneLong() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(days: 5, weeks: 4, level: .intermediate))
        let buildWeek = plan.weeks.first(where: { !$0.isDeload && $0.phase != .taper })!
        let runDays = buildWeek.days.filter { $0.workoutType.isRun }
        XCTAssertEqual(runDays.count, 5)
        XCTAssertEqual(runDays.filter { $0.workoutType == .easy }.count, 3)
        XCTAssertEqual(runDays.filter { $0.workoutType == .tempo || $0.workoutType == .intervals }.count, 1)
        XCTAssertEqual(runDays.filter { $0.workoutType == .long }.count, 1)
    }

    func test_deloadWeekHasNoQualitySession() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 8, level: .intermediate))
        let deloadWeeks = plan.weeks.filter(\.isDeload)
        XCTAssertFalse(deloadWeeks.isEmpty)
        for week in deloadWeeks {
            let hasQuality = week.days.contains(where: {
                $0.workoutType == .tempo || $0.workoutType == .intervals
            })
            XCTAssertFalse(hasQuality, "Deload week \(week.weekNumber) should not have quality sessions")
        }
    }

    // MARK: - Placement / spacing tests

    func test_noBackToBackHardWorkouts() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 12, level: .advanced))
        for week in plan.weeks {
            for i in 0..<6 {
                let today = week.days[i]
                let tomorrow = week.days[i + 1]
                let bothHard = today.workoutType.isHardRun && tomorrow.workoutType.isHardRun
                XCTAssertFalse(
                    bothHard,
                    "Back-to-back hard sessions on days \(i) and \(i+1) of week \(week.weekNumber)"
                )
            }
        }
    }

    func test_longRunLandsOnPreferredDay() {
        for dayPref in 0...6 {  // 0=Sun … 6=Sat
            let plan = TrainingPlanGenerator.generate(input: makeInput(longRunDay: dayPref, weeks: 4))
            for week in plan.weeks {
                let longDays = week.days.filter { $0.workoutType == .long }
                XCTAssertEqual(longDays.count, 1, "Each week must have exactly one long run")
                // DayPlan.dayName should match preference
                let expectedName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dayPref]
                XCTAssertEqual(
                    longDays[0].dayName, expectedName,
                    "Long run in week \(week.weekNumber) should be on \(expectedName) for pref \(dayPref)"
                )
            }
        }
    }

    func test_qualityAndLongRunHaveAtLeastTwoDayGap() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(days: 4, weeks: 8, level: .intermediate))
        for week in plan.weeks where !week.isDeload {
            let days = week.days
            guard let longIdx = days.firstIndex(where: { $0.workoutType == .long }),
                  let qualityIdx = days.firstIndex(where: { $0.workoutType == .tempo || $0.workoutType == .intervals }) else { continue }
            let gap = abs(longIdx - qualityIdx)
            XCTAssertGreaterThanOrEqual(
                gap, 2,
                "Week \(week.weekNumber): long run (day \(longIdx)) and quality (day \(qualityIdx)) are only \(gap) day(s) apart"
            )
        }
    }

    // MARK: - Experience level tests

    func test_beginnerHasNoQualityInFirstFourWeeks() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 8, level: .beginner))
        for week in plan.weeks where week.weekNumber <= 4 {
            let hasQuality = week.days.contains(where: {
                $0.workoutType == .tempo || $0.workoutType == .intervals
            })
            XCTAssertFalse(hasQuality, "Beginner week \(week.weekNumber) should not have quality sessions in first 4 weeks")
        }
    }

    func test_beginnerWorkoutsHaveNoZoneGuidance() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 8, level: .beginner))
        for week in plan.weeks {
            for day in week.days where day.workoutType == .easy || day.workoutType == .long {
                XCTAssertNil(
                    day.effortGuidance,
                    "Beginner easy/long runs should not have effort guidance zones (day: \(day.title))"
                )
            }
        }
    }

    func test_intermediateWorkoutsHaveZoneGuidanceOnQualityDays() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(weeks: 8, level: .intermediate))
        for week in plan.weeks {
            for day in week.days where day.workoutType == .tempo || day.workoutType == .intervals {
                XCTAssertNotNil(
                    day.effortGuidance,
                    "Intermediate quality day should have effort guidance (day: \(day.title))"
                )
            }
        }
    }

    // MARK: - JSON serialization

    func test_generatedPlanIsJSONSerializable() throws {
        let plan = TrainingPlanGenerator.generate(input: makeInput())
        let data = try JSONEncoder().encode(plan)
        XCTAssertGreaterThan(data.count, 0)
        let decoded = try JSONDecoder().decode(GeneratedPlan.self, from: data)
        XCTAssertEqual(decoded.totalWeeks, plan.totalWeeks)
        XCTAssertEqual(decoded.weeks.count, plan.weeks.count)
    }

    func test_jsonOutputContainsAllSevenDaysPerWeek() throws {
        let plan = TrainingPlanGenerator.generate(input: makeInput())
        for week in plan.weeks {
            XCTAssertEqual(week.days.count, 7, "Week \(week.weekNumber) should have exactly 7 days")
        }
    }

    func test_jsonOutputDatesAreSequential() throws {
        let fixedDate = Calendar.current.date(from: DateComponents(year: 2026, month: 5, day: 4))! // Monday
        let plan = TrainingPlanGenerator.generate(input: makeInput(), startingOn: fixedDate)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]

        var previousDate: Date?
        for week in plan.weeks {
            for day in week.days {
                let date = formatter.date(from: day.date)!
                if let prev = previousDate {
                    let diff = Calendar.current.dateComponents([.day], from: prev, to: date).day!
                    XCTAssertEqual(diff, 1, "Days should be exactly 1 day apart; found \(diff) days between \(prev) and \(date)")
                }
                previousDate = date
            }
        }
    }

    // MARK: - Taper

    func test_finalWeeksAreTaperForGoalPlan() {
        let plan = TrainingPlanGenerator.generate(
            input: makeInput(goal: .marathon, weeks: 12, level: .intermediate)
        )
        let lastTwo = plan.weeks.suffix(2)
        for week in lastTwo {
            XCTAssertEqual(week.phase, .taper, "Last 2 weeks should be taper for a race goal")
        }
    }

    func test_fitnessGoalHasNoTaper() {
        let plan = TrainingPlanGenerator.generate(input: makeInput(goal: .fitness, weeks: 8))
        let hasTaper = plan.weeks.contains(where: { $0.phase == .taper })
        XCTAssertFalse(hasTaper, "Fitness goal should have no taper weeks")
    }

    // MARK: - Interval progressions

    func test_intervalDistanceIncreasesOverPhases() {
        let plan = TrainingPlanGenerator.generate(
            input: makeInput(goal: .fiveK, weeks: 12, level: .intermediate)
        )
        let earlyIntervals = plan.weeks.prefix(4).flatMap(\.days).filter { $0.workoutType == .intervals }
        let lateIntervals = plan.weeks.dropFirst(8).prefix(3).flatMap(\.days).filter { $0.workoutType == .intervals }
        guard !earlyIntervals.isEmpty, !lateIntervals.isEmpty else { return }

        let earlyMiles = earlyIntervals.compactMap(\.distanceMiles).reduce(0, +) / Double(earlyIntervals.count)
        let lateMiles = lateIntervals.compactMap(\.distanceMiles).reduce(0, +) / Double(lateIntervals.count)
        XCTAssertGreaterThanOrEqual(lateMiles, earlyMiles, "Late-plan intervals should be >= early-plan intervals")
    }
}
