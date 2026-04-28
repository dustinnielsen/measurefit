import Foundation

// MARK: - Entry point

/// Pure, stateless plan generator. Same input → same output. No SwiftData dependency.
struct TrainingPlanGenerator {

    static func generate(input: PlanInput, startingOn startDate: Date? = nil) -> GeneratedPlan {
        let planStart = startDate ?? nextMonday(from: Date())
        let totalWeeks = input.goalTimelineWeeks
        let weeklyVolumes = computeWeeklyVolumes(input: input)
        let peakMiles = weeklyVolumes.max() ?? input.currentWeeklyMileage

        var weeks: [WeekPlan] = []
        for weekIndex in 0..<totalWeeks {
            let weekNumber = weekIndex + 1
            let targetMiles = weeklyVolumes[weekIndex]
            let phase = phaseFor(weekNumber: weekNumber, totalWeeks: totalWeeks, input: input)
            let isDeload = phase == .deload
            let weekStart = Calendar.current.date(
                byAdding: .weekOfYear, value: weekIndex, to: planStart
            )!
            let week = buildWeek(
                weekNumber: weekNumber,
                weekStart: weekStart,
                targetMiles: targetMiles,
                phase: phase,
                isDeload: isDeload,
                input: input
            )
            weeks.append(week)
        }

        return GeneratedPlan(
            input: input,
            generatedAt: iso8601(Date()),
            startDate: iso8601(planStart),
            totalWeeks: totalWeeks,
            peakWeeklyMiles: peakMiles,
            weeks: weeks
        )
    }
}

// MARK: - Volume progression

private extension TrainingPlanGenerator {

    /// Computes target mileage for every week, respecting 10% rule, deloads, and taper.
    static func computeWeeklyVolumes(input: PlanInput) -> [Double] {
        let total = input.goalTimelineWeeks
        let hasTaper = input.goalDistance.needsTaper && total >= 6
        let taperCount = hasTaper ? 2 : 0
        let buildPlusDeloadCount = total - taperCount

        // Achievable peak = what can actually be reached given the timeline and 10% rule.
        let goalPeak = targetPeakMileage(input: input)
        let achievable = achievablePeak(
            start: max(input.currentWeeklyMileage, minStartMileage(input: input)),
            goalPeak: goalPeak,
            buildWeeks: buildWeekCount(total: buildPlusDeloadCount)
        )

        var volumes: [Double] = Array(repeating: 0, count: total)
        var lastBuildMiles = max(input.currentWeeklyMileage, minStartMileage(input: input))

        for i in 0..<total {
            let weekNumber = i + 1
            let isTaper = hasTaper && weekNumber > buildPlusDeloadCount
            let isDeload = !isTaper && weekNumber % 4 == 0

            if isTaper {
                let taperIndex = weekNumber - buildPlusDeloadCount  // 1 or 2
                let factor = taperIndex == 1 ? 0.75 : 0.60
                volumes[i] = round1(achievable * factor)
            } else if isDeload {
                // Step back 20–25% from the last build week.
                let reductionFactor = input.injuryRisk == .high ? 0.75 : 0.80
                volumes[i] = round1(lastBuildMiles * reductionFactor)
                // lastBuildMiles is NOT updated on deload weeks — we resume from here next week.
            } else {
                // Build week: apply 10% cap (adjusted for injury risk).
                let next = input.injuryRisk.maxWeeklyIncrease(base: lastBuildMiles)
                let capped = min(next, achievable)
                volumes[i] = round1(capped)
                lastBuildMiles = capped
            }
        }
        return volumes
    }

    static func targetPeakMileage(input: PlanInput) -> Double {
        let range = input.goalDistance.peakMileageRange
        let current = input.currentWeeklyMileage
        guard current < range.upperBound else { return current * 1.05 }
        // Land in the lower third of the range for conservative/injured; upper third for advanced.
        let fraction: Double
        switch (input.experienceLevel, input.injuryRisk) {
        case (.beginner, _), (_, .high):  fraction = 0.25
        case (.intermediate, .medium):    fraction = 0.55
        case (.intermediate, .low):       fraction = 0.70
        case (.advanced, .medium):        fraction = 0.80
        case (.advanced, .low):           fraction = 1.00
        default:                          fraction = 0.50
        }
        let target = range.lowerBound + (range.upperBound - range.lowerBound) * fraction
        return max(current + 1, target)
    }

    static func minStartMileage(input: PlanInput) -> Double {
        switch input.experienceLevel {
        case .beginner:     return 10
        case .intermediate: return 15
        case .advanced:     return 20
        }
    }

    /// Number of true build weeks in a block (deload weeks excluded).
    static func buildWeekCount(total: Int) -> Int {
        // In a 3-up/1-down cycle: 3 build weeks per 4 weeks.
        let fullCycles = total / 4
        let remainder = total % 4
        return fullCycles * 3 + min(remainder, 3)
    }

    /// Maximum mileage achievable from `start` in `buildWeeks` build weeks at the injury-risk cap.
    static func achievablePeak(start: Double, goalPeak: Double, buildWeeks: Int) -> Double {
        var peak = start
        for _ in 0..<buildWeeks {
            peak = min(peak * 1.10, goalPeak)  // use 10% even for conservative — it's the hard ceiling
            if peak >= goalPeak { break }
        }
        return peak
    }
}

// MARK: - Phase assignment

private extension TrainingPlanGenerator {

    static func phaseFor(weekNumber: Int, totalWeeks: Int, input: PlanInput) -> PlanPhase {
        let hasTaper = input.goalDistance.needsTaper && totalWeeks >= 6
        let taperStart = hasTaper ? totalWeeks - 1 : Int.max  // weeks totalWeeks-1 and totalWeeks

        if hasTaper && weekNumber >= taperStart { return .taper }
        if weekNumber % 4 == 0 { return .deload }

        guard input.goalDistance.needsTaper else { return .base }

        let buildAndDeload = hasTaper ? totalWeeks - 2 : totalWeeks
        let ratio = Double(weekNumber) / Double(buildAndDeload)
        if ratio < 0.40 { return .base }
        if ratio < 0.75 { return .build }
        return .peak
    }
}

// MARK: - Week builder

private extension TrainingPlanGenerator {

    static func buildWeek(
        weekNumber: Int,
        weekStart: Date,
        targetMiles: Double,
        phase: PlanPhase,
        isDeload: Bool,
        input: PlanInput
    ) -> WeekPlan {
        // Determine whether this week gets a quality (hard) session.
        let hasQuality = shouldHaveQuality(
            weekNumber: weekNumber, phase: phase, isDeload: isDeload, input: input
        )

        // Assign workout types to Mon–Sun offsets (0=Mon … 6=Sun).
        let slotMap = assignSlots(
            daysPerWeek: input.daysPerWeek,
            longRunDay: sundayBasedToMon(input.preferredLongRunDay),
            hasQuality: hasQuality
        )

        // Compute distances for each running slot.
        let distances = distributeDistance(
            targetMiles: targetMiles,
            slotMap: slotMap,
            weekNumber: weekNumber,
            input: input
        )

        let cal = Calendar.current
        let dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

        let days: [DayPlan] = (0..<7).map { offset in
            let date = cal.date(byAdding: .day, value: offset, to: weekStart)!
            let type = slotMap[offset] ?? .rest
            let distance = distances[offset]
            return makeDayPlan(
                date: date,
                dayName: dayNames[offset],
                workoutType: type,
                distance: distance,
                weekNumber: weekNumber,
                phase: phase,
                isDeload: isDeload,
                input: input
            )
        }

        return WeekPlan(
            weekNumber: weekNumber,
            phase: phase,
            targetMiles: targetMiles,
            isDeload: isDeload,
            days: days
        )
    }
}

// MARK: - Quality session logic

private extension TrainingPlanGenerator {

    static func shouldHaveQuality(
        weekNumber: Int, phase: PlanPhase, isDeload: Bool, input: PlanInput
    ) -> Bool {
        if isDeload { return false }
        if phase == .taper { return false }

        switch input.experienceLevel {
        case .beginner:
            // Beginners get tempo starting week 5, but only in build/peak — not in base early weeks.
            return weekNumber >= 5 && phase != .base
        case .intermediate:
            return true
        case .advanced:
            return true
        }
    }

    /// Tempo in base phase; intervals in build/peak; advanced gets intervals sooner.
    static func qualityType(weekNumber: Int, phase: PlanPhase, input: PlanInput) -> DayWorkoutType {
        switch phase {
        case .base:            return .tempo
        case .build, .peak:    return input.experienceLevel == .beginner ? .tempo : .intervals
        case .taper, .deload:  return .easy  // fallback; shouldHaveQuality prevents reaching here
        }
    }
}

// MARK: - Slot assignment

private extension TrainingPlanGenerator {

    /// Returns a map of Mon-based offset (0=Mon…6=Sun) → WorkoutType for the running days.
    /// Rest days are absent from the map (caller fills them as .rest).
    ///
    /// Day-count rules:
    ///   3 days: 1 easy  + 1 quality/easy + 1 long
    ///   4 days: 2 easy  + 1 quality/easy + 1 long
    ///   5 days: 3 easy  + 1 quality/easy + 1 long
    static func assignSlots(
        daysPerWeek: Int,
        longRunDay: Int,    // Mon-based: 0=Mon … 6=Sun
        hasQuality: Bool
    ) -> [Int: DayWorkoutType] {
        var slots: [Int: DayWorkoutType] = [:]

        // 1. Long run
        slots[longRunDay] = .long

        // 2. Quality session (or easy substitute if !hasQuality handled by caller)
        let qualityOffset: Int?
        if hasQuality {
            let q = bestSlot(
                longRunDay: longRunDay,
                taken: Set(slots.keys),
                preferBefore: true
            )
            slots[q] = .tempo  // actual type (.tempo/.intervals) resolved in makeDayPlan
            qualityOffset = q
        } else {
            qualityOffset = nil
        }

        // 3. Easy runs — fill up to daysPerWeek
        let easyNeeded = daysPerWeek - slots.count
        let easySlots = bestEasySlots(
            longRunDay: longRunDay,
            qualityOffset: qualityOffset,
            taken: Set(slots.keys),
            count: easyNeeded
        )
        for offset in easySlots { slots[offset] = .easy }

        return slots
    }

    /// Finds the best slot for the quality session.
    /// Prefers 2–4 days before the long run; falls back to 2–4 days after.
    static func bestSlot(longRunDay: Int, taken: Set<Int>, preferBefore: Bool) -> Int {
        // Score each free slot by how suitable it is for a hard workout.
        let candidates = (0..<7).filter { !taken.contains($0) }

        func score(_ offset: Int) -> Double {
            let gapBefore = longRunDay - offset   // positive = before long run (within Mon-Sun)
            let gapAfter  = offset - longRunDay   // positive = after long run

            // Adjacent (±1) is always bad.
            if abs(gapBefore) == 1 || abs(gapAfter) == 1 { return -1 }

            if gapBefore >= 2 {
                // Before long run — this is the primary preference.
                if gapBefore == 2 || gapBefore == 3 { return 100 }
                if gapBefore == 4 { return 80 }
                if gapBefore == 5 { return 60 }
                return 40
            } else {
                // After long run — secondary preference for early-week long runs.
                if gapAfter == 2 || gapAfter == 3 { return 50 }
                if gapAfter == 4 { return 35 }
                if gapAfter == 5 { return 20 }
                return 5
            }
        }

        return candidates.max(by: { score($0) < score($1) }) ?? candidates.first ?? (longRunDay + 3) % 7
    }

    /// Returns `count` offsets for easy runs, in placement priority order.
    static func bestEasySlots(
        longRunDay: Int,
        qualityOffset: Int?,
        taken: Set<Int>,
        count: Int
    ) -> [Int] {
        guard count > 0 else { return [] }

        // Build a priority-ordered list of candidate offsets.
        var priority: [Int] = []

        // Priority 1: shakeout run (day before long run). Only if there's room in the week.
        let shakeout = longRunDay - 1
        if shakeout >= 0 { priority.append(shakeout) }

        // Priority 2: if quality is placed, a buffer run between quality and long adds recovery.
        if let q = qualityOffset, q < longRunDay {
            let buffer = q + 1
            if buffer < longRunDay { priority.append(buffer) }
        }

        // Priority 3: day after long run (recovery easy), if long run isn't on Sunday.
        if longRunDay < 6 { priority.append(longRunDay + 1) }

        // Priority 4: fill remaining midweek slots (prefer centre of the week).
        let midweekOrder = [2, 1, 3, 0, 4, 5, 6]  // Wed, Tue, Thu, Mon, Fri, Sat, Sun
        for d in midweekOrder where !priority.contains(d) { priority.append(d) }

        // Pick the first `count` candidates that aren't already taken.
        return priority
            .filter { !taken.contains($0) }
            .prefix(count)
            .map { $0 }
    }

    /// Convert Sunday-based day (0=Sun…6=Sat) to Monday-based (0=Mon…6=Sun).
    static func sundayBasedToMon(_ day: Int) -> Int {
        day == 0 ? 6 : day - 1
    }
}

// MARK: - Distance distribution

private extension TrainingPlanGenerator {

    /// Distributes `targetMiles` across the running slots, returning [offset: miles].
    static func distributeDistance(
        targetMiles: Double,
        slotMap: [Int: DayWorkoutType],
        weekNumber: Int,
        input: PlanInput
    ) -> [Int: Double] {
        var result: [Int: Double] = [:]

        // Long run: 28–32% of weekly volume, capped by goal and first-week long-run ceiling.
        let longRunPercent = 0.30
        var longMiles = round1(targetMiles * longRunPercent)
        longMiles = min(longMiles, input.goalDistance.maxLongRunMiles)
        if weekNumber == 1 {
            // First long run must not exceed longest recent run by more than 10%.
            longMiles = min(longMiles, round1(input.longestRecentRun * 1.10))
        }
        longMiles = max(longMiles, 3)

        if let longOffset = slotMap.first(where: { $0.value == .long })?.key {
            result[longOffset] = longMiles
        }

        // Quality run: fixed structure-driven distance (not from remaining budget).
        let qualityMiles = qualityDistance(
            weeklyTarget: targetMiles, weekNumber: weekNumber, input: input
        )
        if let qualityOffset = slotMap.first(where: { $0.value == .tempo })?.key {
            result[qualityOffset] = qualityMiles
        }

        // Remaining miles split evenly across easy runs.
        let easyOffsets = slotMap.filter { $0.value == .easy }.map(\.key)
        let allocatedMiles = (result.values.reduce(0, +))
        let easyBudget = max(0, targetMiles - allocatedMiles)
        let perEasy = easyOffsets.isEmpty ? 0 : round1(easyBudget / Double(easyOffsets.count))
        for offset in easyOffsets {
            result[offset] = max(2.0, perEasy)
        }

        return result
    }

    static func qualityDistance(weeklyTarget: Double, weekNumber: Int, input: PlanInput) -> Double {
        // Quality = roughly 20–25% of weekly volume, capped at reasonable session lengths.
        let base = weeklyTarget * 0.22
        return round1(max(3.0, min(8.0, base)))
    }
}

// MARK: - Day plan construction

private extension TrainingPlanGenerator {

    static func makeDayPlan(
        date: Date,
        dayName: String,
        workoutType: DayWorkoutType,
        distance: Double?,
        weekNumber: Int,
        phase: PlanPhase,
        isDeload: Bool,
        input: PlanInput
    ) -> DayPlan {
        // Resolve the true quality type (tempo vs intervals) based on context.
        let resolvedType: DayWorkoutType
        if workoutType == .tempo {
            resolvedType = qualityType(weekNumber: weekNumber, phase: phase, input: input)
        } else {
            resolvedType = workoutType
        }

        switch resolvedType {
        case .easy:
            return makeEasyRun(date: date, dayName: dayName, miles: distance ?? 4, isDeload: isDeload, input: input)
        case .long:
            return makeLongRun(date: date, dayName: dayName, miles: distance ?? 6, input: input)
        case .tempo:
            return makeTempoRun(date: date, dayName: dayName, totalMiles: distance ?? 5, weekNumber: weekNumber, input: input)
        case .intervals:
            return makeIntervalRun(date: date, dayName: dayName, weekNumber: weekNumber, phase: phase, input: input)
        case .rest:
            return makeRest(date: date, dayName: dayName)
        case .strength:
            return makeStrength(date: date, dayName: dayName)
        case .mobility:
            return makeMobility(date: date, dayName: dayName)
        }
    }
}

// MARK: - Easy run

private extension TrainingPlanGenerator {

    static func makeEasyRun(
        date: Date, dayName: String, miles: Double, isDeload: Bool, input: PlanInput
    ) -> DayPlan {
        let title = "Easy Run — \(fmt(miles)) mi"
        let effort: EffortGuidance? = input.experienceLevel.usesPaceZones ? .zone2 : nil
        let structure = WorkoutStructure(
            warmup: nil,
            mainSet: "\(fmt(miles)) miles at easy, fully conversational effort",
            cooldown: nil
        )
        let note = isDeload
            ? "Deload week — keep this genuinely easy. Slower than your normal easy pace is fine. Your body is adapting to last week's training, not this one."
            : "Stay fully conversational the entire time. If you can't say a sentence, slow down. Most runners run their easy days 60–90 seconds per mile too fast."
        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .easy,
            title: title, distanceMiles: miles, durationMinutes: nil,
            effortGuidance: effort, workoutStructure: structure, coachingNote: note
        )
    }
}

// MARK: - Long run

private extension TrainingPlanGenerator {

    static func makeLongRun(
        date: Date, dayName: String, miles: Double, input: PlanInput
    ) -> DayPlan {
        let title = "Long Run — \(fmt(miles)) mi"
        // Long run is SLOWER than easy — Zone 1–2 for experienced runners.
        let effort: EffortGuidance? = input.experienceLevel.usesPaceZones
            ? EffortGuidance(
                zone: "Zone 1–2",
                rpe: "3–5 / 10",
                heartRateZone: "60–70% max HR",
                feel: "Slower than easy — you should be able to sing"
              )
            : nil
        let structure = WorkoutStructure(
            warmup: nil,
            mainSet: "\(fmt(miles)) miles at easy-to-moderate effort, staying fully comfortable",
            cooldown: nil
        )
        let injuryNote = input.injuryRisk == .high
            ? " Avoid hilly terrain today — keep the surface soft and the grade flat."
            : ""
        let note = "The long run builds your aerobic engine and mental durability. Run it slower than your normal easy pace. The goal is time on feet, not speed.\(injuryNote)"
        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .long,
            title: title, distanceMiles: miles, durationMinutes: nil,
            effortGuidance: effort, workoutStructure: structure, coachingNote: note
        )
    }
}

// MARK: - Tempo run

private extension TrainingPlanGenerator {

    static func makeTempoRun(
        date: Date, dayName: String, totalMiles: Double, weekNumber: Int, input: PlanInput
    ) -> DayPlan {
        let warmup = 1.0
        let cooldown = 1.0
        let tempoMiles = max(1.0, round1(totalMiles - warmup - cooldown))

        // Tempo segment duration increases as plan progresses.
        let tempoMinutes: Int
        switch weekNumber {
        case ..<5:  tempoMinutes = 20
        case ..<9:  tempoMinutes = 25
        default:    tempoMinutes = 30
        }

        let title = "Tempo Run — \(fmt(totalMiles)) mi"
        let effort: EffortGuidance? = input.experienceLevel.usesPaceZones ? .zone3_4 : nil

        let structureDescription: String
        if input.experienceLevel == .beginner {
            structureDescription = "1.0 mi easy warm-up → \(fmt(tempoMiles)) mi at a 7/10 effort (hard but controlled) → 1.0 mi easy cool-down"
        } else {
            structureDescription = "1.0 mi easy warm-up → \(fmt(tempoMiles)) mi at Zone 3–4 / tempo effort (~\(tempoMinutes) min) → 1.0 mi easy cool-down"
        }

        let structure = WorkoutStructure(
            warmup: "1.0 mi easy warm-up",
            mainSet: "\(fmt(tempoMiles)) mi at tempo effort (\(tempoMinutes) min)",
            cooldown: "1.0 mi easy cool-down"
        )

        let note: String
        if input.experienceLevel == .beginner {
            note = "Tempo effort = 7/10. You can say a few words but not hold a conversation. Start conservatively — it should feel hard by the end, not the beginning."
        } else {
            note = "Tempo pace is the fastest effort you can sustain for 20–40 minutes. It builds your lactate threshold — the cornerstone of distance running performance. Start 5 seconds per mile slower than you think you need to."
        }

        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .tempo,
            title: title, distanceMiles: totalMiles, durationMinutes: nil,
            effortGuidance: effort, workoutStructure: structure, coachingNote: note
        )
    }
}

// MARK: - Interval run

private extension TrainingPlanGenerator {

    static func makeIntervalRun(
        date: Date, dayName: String, weekNumber: Int, phase: PlanPhase,
        input: PlanInput
    ) -> DayPlan {
        let p = intervalPrescription(weekNumber: weekNumber, goal: input.goalDistance, level: input.experienceLevel)

        let title = "Intervals — \(p.reps) × \(p.repDistance) m"
        let effort: EffortGuidance? = input.experienceLevel.usesPaceZones ? .zone4_5 : nil
        let warmupCooldown = 2.0
        let totalMiles = round1(p.totalApproxMiles + warmupCooldown)

        let mainSetDesc = "\(p.reps) × \(p.repDistance) m at \(p.repPace) with \(p.recovery) between"
        let structure = WorkoutStructure(
            warmup: "1.0 mi easy warm-up",
            mainSet: mainSetDesc,
            cooldown: "1.0 mi easy cool-down"
        )

        let note: String
        if input.experienceLevel == .beginner {
            note = "Run each rep at a hard effort (8–9/10). Slow down if form breaks down. Equal rest between reps. The goal is controlled speed, not surviving."
        } else {
            note = "Run every rep at the same effort — resist going out fast on rep 1. If rep 6 feels easier than rep 2, you went out too conservatively; if rep 6 is a death march, you went out too hard. Lock in."
        }

        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .intervals,
            title: title, distanceMiles: totalMiles, durationMinutes: nil,
            effortGuidance: effort, workoutStructure: structure, coachingNote: note
        )
    }

    /// Returns the specific interval prescription for the given week and goal.
    /// Prescriptions progress from short/fast (early) to long/specific (late).
    static func intervalPrescription(
        weekNumber: Int,
        goal: GoalDistance,
        level: ExperienceLevel
    ) -> IntervalPrescription {
        // Three progression phases: early (weeks 1–4), mid (5–8), late (9+).
        let stage: Int = weekNumber <= 4 ? 0 : weekNumber <= 8 ? 1 : 2

        // Reps scale slightly with experience level.
        let repMultiplier = level == .advanced ? 1 : 0  // adds extra rep for advanced

        switch (goal, stage) {

        // ── 5K: speed-focused, short reps ──────────────────────────────────────
        case (.fiveK, 0):
            return IntervalPrescription(reps: 6 + repMultiplier, repDistance: 400, repPace: "5K effort", recovery: "90 sec jog", totalApproxMiles: 1.5)
        case (.fiveK, 1):
            return IntervalPrescription(reps: 5 + repMultiplier, repDistance: 800, repPace: "5K effort", recovery: "2 min jog", totalApproxMiles: 2.5)
        case (.fiveK, _):
            return IntervalPrescription(reps: 4 + repMultiplier, repDistance: 1200, repPace: "5K–10K effort", recovery: "2 min jog", totalApproxMiles: 3.0)

        // ── 10K: mix of speed and strength ─────────────────────────────────────
        case (.tenK, 0):
            return IntervalPrescription(reps: 6 + repMultiplier, repDistance: 400, repPace: "5K effort", recovery: "90 sec jog", totalApproxMiles: 1.5)
        case (.tenK, 1):
            return IntervalPrescription(reps: 4 + repMultiplier, repDistance: 1000, repPace: "10K effort", recovery: "90 sec jog", totalApproxMiles: 2.5)
        case (.tenK, _):
            return IntervalPrescription(reps: 3 + repMultiplier, repDistance: 1600, repPace: "10K–threshold effort", recovery: "2:30 jog", totalApproxMiles: 3.0)

        // ── Half marathon: threshold-oriented ──────────────────────────────────
        case (.halfMarathon, 0):
            return IntervalPrescription(reps: 5 + repMultiplier, repDistance: 800, repPace: "10K effort", recovery: "90 sec jog", totalApproxMiles: 2.5)
        case (.halfMarathon, 1):
            return IntervalPrescription(reps: 4 + repMultiplier, repDistance: 1200, repPace: "threshold effort", recovery: "2 min jog", totalApproxMiles: 3.0)
        case (.halfMarathon, _):
            return IntervalPrescription(reps: 3 + repMultiplier, repDistance: 1600, repPace: "half-marathon pace", recovery: "2 min jog", totalApproxMiles: 3.0)

        // ── Marathon: mostly tempo, intervals are secondary ─────────────────────
        case (.marathon, 0), (.marathon, 1):
            return IntervalPrescription(reps: 4 + repMultiplier, repDistance: 1000, repPace: "threshold effort", recovery: "90 sec jog", totalApproxMiles: 2.5)
        case (.marathon, _):
            return IntervalPrescription(reps: 3 + repMultiplier, repDistance: 1600, repPace: "marathon pace", recovery: "1:30 jog", totalApproxMiles: 3.0)

        // ── Faster mile / fitness / default ────────────────────────────────────
        default:
            return IntervalPrescription(reps: 6 + repMultiplier, repDistance: 400, repPace: "mile effort", recovery: "90 sec jog", totalApproxMiles: 1.5)
        }
    }
}

// MARK: - Non-run days

private extension TrainingPlanGenerator {

    static func makeRest(date: Date, dayName: String) -> DayPlan {
        let notes = [
            "Full rest. The adaptation happens during recovery, not the run. Today is training.",
            "Rest day. A short walk is fine — nothing structured. Sleep and eat well.",
            "Off day. Your body is rebuilding stronger. Trust the process.",
        ]
        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .rest,
            title: "Rest Day", distanceMiles: nil, durationMinutes: nil,
            effortGuidance: nil, workoutStructure: nil,
            coachingNote: notes[abs(date.hashValue) % notes.count]
        )
    }

    static func makeStrength(date: Date, dayName: String) -> DayPlan {
        let structure = WorkoutStructure(
            warmup: "5 min light movement / dynamic stretching",
            mainSet: "2–3 sets each: single-leg deadlift, glute bridge, side-lying clamshell, calf raise, dead bug, Copenhagen plank",
            cooldown: "5 min static stretching"
        )
        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .strength,
            title: "Strength Training — 40 min",
            distanceMiles: nil, durationMinutes: 40,
            effortGuidance: nil, workoutStructure: structure,
            coachingNote: "Glutes, hips, and core are the engine of injury-free running. This session pays dividends over months, not days."
        )
    }

    static func makeMobility(date: Date, dayName: String) -> DayPlan {
        let structure = WorkoutStructure(
            warmup: nil,
            mainSet: "Foam roll: calves, quads, IT band, glutes (60 sec each). Stretch: hip flexors, hamstrings, piriformis, calf (30–45 sec per side).",
            cooldown: nil
        )
        return DayPlan(
            date: iso8601(date), dayName: dayName, workoutType: .mobility,
            title: "Mobility & Recovery — 20 min",
            distanceMiles: nil, durationMinutes: 20,
            effortGuidance: nil, workoutStructure: structure,
            coachingNote: "Mobility work after a hard week reduces injury risk and improves running economy. Skipping it is a false saving."
        )
    }
}

// MARK: - Formatting helpers

private extension TrainingPlanGenerator {

    static func fmt(_ miles: Double) -> String {
        String(format: "%.1f", miles)
    }

    static func round1(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    static func iso8601(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.string(from: date)
    }
}

// MARK: - Next Monday

extension TrainingPlanGenerator {
    /// Returns the next Monday (never today, even if today is Monday).
    static func nextMonday(from date: Date = Date()) -> Date {
        let cal = Calendar.current
        let weekday = cal.component(.weekday, from: date)
        // weekday: 1=Sun, 2=Mon, … 7=Sat
        let daysUntilMonday = weekday == 2 ? 7 : (9 - weekday) % 7
        return cal.date(byAdding: .day, value: daysUntilMonday, to: cal.startOfDay(for: date))!
    }
}

// MARK: - SwiftData bridge

extension TrainingPlanGenerator {

    /// Converts a GeneratedPlan into SwiftData objects ready to insert into ModelContext.
    static func toSwiftDataObjects(
        from generatedPlan: GeneratedPlan
    ) -> (plan: TrainingPlan, workouts: [WorkoutDay]) {
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]

        let startDate = dateFormatter.date(from: generatedPlan.startDate) ?? Date()
        let plan = TrainingPlan(
            startDate: startDate,
            totalWeeks: generatedPlan.totalWeeks,
            peakWeeklyMileage: generatedPlan.peakWeeklyMiles
        )

        var allWorkouts: [WorkoutDay] = []
        for week in generatedPlan.weeks {
            for day in week.days {
                guard let date = dateFormatter.date(from: day.date) else { continue }
                let workoutType = bridgeType(day.workoutType)
                let phase = bridgePhase(week.phase)
                let workout = WorkoutDay(
                    date: date,
                    weekNumber: week.weekNumber,
                    dayOfWeek: Calendar.current.component(.weekday, from: date) % 7,
                    workoutType: workoutType,
                    distanceMiles: day.distanceMiles,
                    durationMinutes: day.durationMinutes,
                    description: day.title,
                    coachingNotes: day.coachingNote,
                    phase: phase
                )
                allWorkouts.append(workout)
            }
        }
        return (plan, allWorkouts)
    }

    private static func bridgeType(_ type: DayWorkoutType) -> WorkoutType {
        switch type {
        case .easy:      return .easy
        case .long:      return .long
        case .tempo:     return .tempo
        case .intervals: return .intervals
        case .rest:      return .rest
        case .strength:  return .strength
        case .mobility:  return .mobility
        }
    }

    private static func bridgePhase(_ phase: PlanPhase) -> TrainingPhase {
        switch phase {
        case .base:   return .base
        case .build:  return .build
        case .peak:   return .peak
        case .taper:  return .taper
        case .deload: return .deload
        }
    }
}
