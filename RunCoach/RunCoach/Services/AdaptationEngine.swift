import Foundation

// MARK: - Result types

struct AdaptationResult {
    let signalLevel: SignalLevel
    let signals: AdaptationSignals
    let adjustments: [WorkoutAdjustment]
    let messages: [AdaptationMessage]
    let requiresMedicalAttention: Bool

    var hasChanges: Bool { !adjustments.isEmpty }
}

enum SignalLevel: String {
    case ok       // no changes needed
    case caution  // mild adjustments
    case concern  // moderate adjustments
    case danger   // quality removed, flag doctor

    var label: String {
        switch self {
        case .ok:      return "Looking good"
        case .caution: return "Taking it easy"
        case .concern: return "Plan adjusted"
        case .danger:  return "Safety mode"
        }
    }
}

struct AdaptationSignals {
    let worstPain: PainLevel
    let fatigue: FatigueLevel
    let performance: PerformanceLevel
    let completionRate: Double
}

enum FatigueLevel {
    case fresh    // effort is low, energy high, sleeping well
    case normal   // baseline
    case tired    // one indicator elevated
    case high     // multiple indicators elevated
}

enum PerformanceLevel {
    case struggling  // easy runs feel hard
    case normal
    case strong      // hard runs feel easy, energy high
}

struct WorkoutAdjustment: Identifiable {
    let id = UUID()
    let workoutDayId: UUID
    let originalTitle: String
    let originalType: WorkoutType
    let newType: WorkoutType
    let newDistanceMiles: Double?
    let newTitle: String
    let newDescription: String
    let newCoachingNote: String
    let adaptationNote: String      // stored on WorkoutDay.adaptationNote — visible to user
}

struct AdaptationMessage: Identifiable {
    let id = UUID()
    let icon: String       // SF Symbol name
    let text: String
    let isCritical: Bool
}

// MARK: - Engine

struct AdaptationEngine {

    // MARK: - Entry point

    static func analyze(
        recentFeedback: [RunFeedback],
        upcomingWorkouts: [WorkoutDay],
        experienceLevel: ExperienceLevel
    ) -> AdaptationResult {
        let signals = computeSignals(from: recentFeedback)
        let signalLevel = overallLevel(signals: signals)
        let adjustments = generateAdjustments(
            signals: signals,
            signalLevel: signalLevel,
            upcoming: upcomingWorkouts,
            level: experienceLevel
        )
        let messages = buildMessages(
            signals: signals,
            signalLevel: signalLevel,
            adjustments: adjustments
        )
        return AdaptationResult(
            signalLevel: signalLevel,
            signals: signals,
            adjustments: adjustments,
            messages: messages,
            requiresMedicalAttention: signals.worstPain == .sharp
        )
    }

    // MARK: - Apply adjustments to SwiftData objects

    static func apply(_ adjustments: [WorkoutAdjustment], to workouts: [WorkoutDay]) {
        for adj in adjustments {
            guard let workout = workouts.first(where: { $0.id == adj.workoutDayId }) else { continue }

            // Preserve the original values (only on first adaptation — don't overwrite if adapted again).
            if workout.preAdaptTypeRaw == nil {
                workout.preAdaptTypeRaw = workout.workoutTypeRaw
                workout.preAdaptDistance = workout.distanceMiles
            }

            workout.workoutType = adj.newType
            if let newDist = adj.newDistanceMiles { workout.distanceMiles = newDist }
            workout.workoutDescription = adj.newTitle
            workout.coachingNotes = adj.newCoachingNote
            workout.adaptationNote = adj.adaptationNote
        }
    }
}

// MARK: - Signal computation

private extension AdaptationEngine {

    static func computeSignals(from feedback: [RunFeedback]) -> AdaptationSignals {
        // Only look at the last 7 days.
        let recent = feedback.filter {
            $0.recordedAt >= Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        }
        let last3 = feedback.filter {
            $0.recordedAt >= Calendar.current.date(byAdding: .day, value: -3, to: Date())!
        }

        return AdaptationSignals(
            worstPain: worstPain(in: last3),
            fatigue: fatigueLevel(from: recent),
            performance: performanceLevel(from: recent),
            completionRate: completionRate(from: recent)
        )
    }

    /// Highest pain level reported in the supplied feedback set.
    static func worstPain(in feedback: [RunFeedback]) -> PainLevel {
        feedback.map(\.painLevel).max() ?? .none
    }

    /// Composite fatigue signal derived from easy-run effort, energy levels, and sleep.
    /// Each indicator contributes "fatigue points":
    ///   - Easy run effort >= 8:     2 pts (running hard on supposed-easy days = not recovering)
    ///   - Easy run effort 7:        1 pt
    ///   - Energy level "low":       1 pt each
    ///   - Sleep quality "poor":     1 pt each
    static func fatigueLevel(from feedback: [RunFeedback]) -> FatigueLevel {
        var pts = 0

        let easyFeedback = feedback.filter { $0.wasEasyRun }
        for fb in easyFeedback {
            if fb.effortRating >= 8 { pts += 2 }
            else if fb.effortRating >= 7 { pts += 1 }
        }

        pts += feedback.filter { $0.energyLevel == .low }.count
        pts += feedback.filter { $0.sleepQuality == .poor }.count

        switch pts {
        case 0:         return .fresh
        case 1:         return .normal
        case 2...3:     return .tired
        default:        return .high
        }
    }

    /// Performance signal derived from quality-session effort and energy levels.
    /// Strong = hard sessions feeling easy AND energy is consistently high.
    static func performanceLevel(from feedback: [RunFeedback]) -> PerformanceLevel {
        let hardFeedback = feedback.filter { $0.wasHardRun }
        let highEnergyCount = feedback.filter { $0.energyLevel == .high }.count
        let goodSleepCount = feedback.filter { $0.sleepQuality == .good }.count

        // Struggling: easy runs feel very hard, or energy is consistently low.
        if feedback.filter({ $0.wasEasyRun && $0.effortRating >= 8 }).count >= 2 { return .struggling }
        if feedback.filter({ $0.energyLevel == .low }).count >= 3 { return .struggling }

        // Strong: quality sessions felt manageable AND energy/sleep are good.
        let hardEffortLow = hardFeedback.filter { $0.effortRating <= 6 }.count
        if hardEffortLow >= 1 && highEnergyCount >= 2 && goodSleepCount >= 2 { return .strong }

        return .normal
    }

    static func completionRate(from feedback: [RunFeedback]) -> Double {
        let runFeedback = feedback.filter { $0.workoutDay?.workoutType.isRun == true }
        guard !runFeedback.isEmpty else { return 1.0 }
        let total = runFeedback.map(\.completionStatus.weight).reduce(0, +)
        return total / Double(runFeedback.count)
    }
}

// MARK: - Overall signal level

private extension AdaptationEngine {

    static func overallLevel(signals: AdaptationSignals) -> SignalLevel {
        // Pain is the primary safety signal.
        switch signals.worstPain {
        case .sharp:    return .danger
        case .moderate: return .concern
        case .mild:
            // Mild pain alone = caution; mild + fatigue = concern.
            return signals.fatigue == .high ? .concern : .caution
        case .none:
            break
        }

        // Fatigue without pain.
        switch signals.fatigue {
        case .high:     return .concern
        case .tired:    return .caution
        case .struggling, .normal, .fresh: break
        }

        if signals.completionRate < 0.40 { return .caution }

        return .ok
    }
}

// MARK: - Adjustment generation

private extension AdaptationEngine {

    /// Returns a list of specific changes to apply to upcoming workouts.
    /// Rules (in priority order — highest severity wins per workout):
    ///
    ///   DANGER  (sharp pain)
    ///     • All quality sessions → easy (reduced 10%)
    ///     • Long run → easy + 30% shorter
    ///
    ///   CONCERN (moderate pain  OR  high fatigue  OR  mild pain + high fatigue)
    ///     • Intervals → easy
    ///     • Tempo → easy
    ///     • Long run → keep type, reduce by 15%
    ///
    ///   CAUTION (mild pain  OR  tired fatigue  OR  low completion)
    ///     • Intervals → tempo
    ///     (no long run change)
    ///
    ///   OK
    ///     • No changes
    ///
    /// Never increase volume or intensity — only reduce or hold.
    static func generateAdjustments(
        signals: AdaptationSignals,
        signalLevel: SignalLevel,
        upcoming: [WorkoutDay],
        level: ExperienceLevel
    ) -> [WorkoutAdjustment] {
        var adjustments: [WorkoutAdjustment] = []
        var adjustedIds = Set<UUID>()

        switch signalLevel {

        case .danger:
            // Remove ALL quality sessions.
            for workout in upcoming where workout.workoutType.isHard {
                guard !adjustedIds.contains(workout.id) else { continue }
                let newDist = (workout.distanceMiles ?? 4) * 0.90
                adjustments.append(makeAdjustment(
                    workout: workout,
                    newType: .easy,
                    newDist: newDist,
                    reason: "Sharp pain reported",
                    coachNote: "This session was replaced with an easy run. Sharp pain is a stop signal — do not push through it. If pain persists beyond 2 days, please see a doctor."
                ))
                adjustedIds.insert(workout.id)
            }
            // Long run → easy and 30% shorter.
            if let longRun = upcoming.first(where: { $0.workoutType == .long && !adjustedIds.contains($0.id) }) {
                let newDist = max(2, (longRun.distanceMiles ?? 6) * 0.70)
                adjustments.append(makeAdjustment(
                    workout: longRun,
                    newType: .easy,
                    newDist: newDist,
                    reason: "Sharp pain reported",
                    coachNote: "Long run replaced with a shorter easy run. Your body needs to recover — the miles will be there when you are."
                ))
                adjustedIds.insert(longRun.id)
            }

        case .concern:
            // Remove all quality sessions.
            for workout in upcoming where workout.workoutType.isHard {
                guard !adjustedIds.contains(workout.id) else { continue }
                let reason = signals.worstPain >= .moderate ? "Moderate pain reported" : "High fatigue detected"
                let note = signals.worstPain >= .moderate
                    ? "Speed work removed due to reported pain. Easy running only until pain resolves."
                    : "Quality session replaced with easy run. Your body is showing high fatigue — more intensity would deepen the hole, not build fitness."
                adjustments.append(makeAdjustment(
                    workout: workout, newType: .easy, newDist: workout.distanceMiles,
                    reason: reason, coachNote: note
                ))
                adjustedIds.insert(workout.id)
            }
            // Long run: keep type, reduce distance by 15%.
            if let longRun = upcoming.first(where: { $0.workoutType == .long && !adjustedIds.contains($0.id) }) {
                let reduction = signals.worstPain >= .moderate ? 0.85 : 0.90
                let newDist = max(3, (longRun.distanceMiles ?? 6) * reduction)
                adjustments.append(makeAdjustment(
                    workout: longRun, newType: .long, newDist: newDist,
                    reason: signals.worstPain >= .moderate ? "Moderate pain reported" : "High fatigue detected",
                    coachNote: "Long run shortened. A slightly shorter long run still builds aerobic base — a shorter run beats no run."
                ))
                adjustedIds.insert(longRun.id)
            }

        case .caution:
            // Downgrade intervals → tempo. Leave tempo and long run unchanged.
            for workout in upcoming where workout.workoutType == .intervals {
                guard !adjustedIds.contains(workout.id) else { continue }
                let reason = signals.worstPain == .mild ? "Mild pain reported" : "Elevated fatigue detected"
                adjustments.append(makeAdjustment(
                    workout: workout, newType: .tempo, newDist: workout.distanceMiles,
                    reason: reason,
                    coachNote: "Interval session replaced with a tempo run. A controlled steady effort provides the stimulus without the impact of hard reps."
                ))
                adjustedIds.insert(workout.id)
            }

        case .ok:
            break
        }

        return adjustments
    }

    static func makeAdjustment(
        workout: WorkoutDay,
        newType: WorkoutType,
        newDist: Double?,
        reason: String,
        coachNote: String
    ) -> WorkoutAdjustment {
        let title: String
        if let d = newDist {
            title = "\(newType.label) — \(String(format: "%.1f", d)) mi"
        } else {
            title = newType.label
        }

        return WorkoutAdjustment(
            workoutDayId: workout.id,
            originalTitle: workout.workoutDescription,
            originalType: workout.workoutType,
            newType: newType,
            newDistanceMiles: newDist,
            newTitle: title,
            newDescription: title,
            newCoachingNote: coachNote,
            adaptationNote: reason
        )
    }
}

// MARK: - Message generation

private extension AdaptationEngine {

    static func buildMessages(
        signals: AdaptationSignals,
        signalLevel: SignalLevel,
        adjustments: [WorkoutAdjustment]
    ) -> [AdaptationMessage] {
        var messages: [AdaptationMessage] = []

        switch signalLevel {
        case .danger:
            messages.append(AdaptationMessage(
                icon: "exclamationmark.octagon.fill",
                text: "Sharp pain is a stop signal. All speed work has been removed from the next 7 days. Easy running only.",
                isCritical: true
            ))
            messages.append(AdaptationMessage(
                icon: "stethoscope",
                text: "If pain persists for more than 2 days, consult a doctor or physiotherapist before resuming training.",
                isCritical: true
            ))
        case .concern:
            if signals.worstPain >= .moderate {
                messages.append(AdaptationMessage(
                    icon: "exclamationmark.triangle.fill",
                    text: "Moderate pain detected. Speed work removed for the next 7 days.",
                    isCritical: true
                ))
            } else {
                messages.append(AdaptationMessage(
                    icon: "bolt.slash.fill",
                    text: "High fatigue detected. Quality sessions replaced with easy running for the next 7 days.",
                    isCritical: false
                ))
            }
            messages.append(AdaptationMessage(
                icon: "bed.double.fill",
                text: "Prioritise sleep and nutrition this week. Adaptation happens during recovery.",
                isCritical: false
            ))
        case .caution:
            if signals.worstPain == .mild {
                messages.append(AdaptationMessage(
                    icon: "exclamationmark.circle.fill",
                    text: "Mild discomfort reported. Interval sessions downgraded to tempo runs.",
                    isCritical: false
                ))
            } else {
                messages.append(AdaptationMessage(
                    icon: "arrow.down.circle.fill",
                    text: "Elevated fatigue detected. Intervals replaced with tempo runs this week.",
                    isCritical: false
                ))
            }
        case .ok:
            if signals.performance == .strong {
                messages.append(AdaptationMessage(
                    icon: "checkmark.seal.fill",
                    text: "You're adapting well. No adjustments needed — stay the course.",
                    isCritical: false
                ))
            } else if adjustments.isEmpty {
                messages.append(AdaptationMessage(
                    icon: "checkmark.circle.fill",
                    text: "All signals look good. No changes to your plan.",
                    isCritical: false
                ))
            }
        }

        return messages
    }
}

// WorkoutType.isRun is defined in Enums.swift.

// MARK: - Internal test hooks
// These wrap private methods so tests can call them via @testable import
// without breaking the private encapsulation of the core logic.

extension AdaptationEngine {
    static func testLevel(signals: AdaptationSignals) -> SignalLevel {
        overallLevel(signals: signals)
    }

    static func testAdjustments(
        signalLevel: SignalLevel,
        signals: AdaptationSignals,
        upcoming: [WorkoutDay]
    ) -> [WorkoutAdjustment] {
        generateAdjustments(signals: signals, signalLevel: signalLevel, upcoming: upcoming, level: .intermediate)
    }

    static func testResult(signals: AdaptationSignals, upcoming: [WorkoutDay]) -> AdaptationResult {
        let level = overallLevel(signals: signals)
        let adjustments = generateAdjustments(signals: signals, signalLevel: level, upcoming: upcoming, level: .intermediate)
        let messages = buildMessages(signals: signals, signalLevel: level, adjustments: adjustments)
        return AdaptationResult(
            signalLevel: level, signals: signals, adjustments: adjustments,
            messages: messages, requiresMedicalAttention: signals.worstPain == .sharp
        )
    }
}
