import SwiftUI

// MARK: - Brand colors

extension Color {
    static let rcAccent   = Color(red: 1.00, green: 0.36, blue: 0.18) // coral-orange
    static let rcSurface  = Color(.secondarySystemGroupedBackground)
    static let rcBase     = Color(.systemGroupedBackground)
    static let rcTertiary = Color(.tertiarySystemGroupedBackground)
}

// MARK: - Workout type colors

extension WorkoutType {
    var accentColor: Color {
        switch self {
        case .easy:      return .green
        case .long:      return Color(red: 0.20, green: 0.50, blue: 0.90)
        case .tempo:     return Color(red: 1.00, green: 0.60, blue: 0.10)
        case .intervals: return Color(red: 0.95, green: 0.25, blue: 0.25)
        case .strides:   return .teal
        case .strength:  return .purple
        case .mobility:  return .mint
        case .rest:      return Color.secondary.opacity(0.6)
        }
    }

    var gradientColors: [Color] {
        [accentColor, accentColor.opacity(0.70)]
    }
}

// MARK: - Workout structure

struct WorkoutStructure {
    let warmup: String
    let mainSet: String
    let cooldown: String
    let effortCue: String
}

extension WorkoutDay {
    /// Derives warmup / main-set / cooldown strings for display.
    var derivedStructure: WorkoutStructure {
        switch workoutType {
        case .easy:
            let dist = distanceMiles.map { String(format: "%.1f mi", $0) } ?? "easy miles"
            return WorkoutStructure(
                warmup:    "5 min brisk walk to loosen up",
                mainSet:   workoutDescription.isEmpty ? "Run \(dist) at a fully conversational pace" : workoutDescription,
                cooldown:  "5 min walk + gentle leg swings and calf stretches",
                effortCue: "Effort 4–5 / 10  ·  You should be able to speak in full sentences"
            )
        case .long:
            return WorkoutStructure(
                warmup:    "10 min easy jog — settle into a relaxed rhythm",
                mainSet:   workoutDescription.isEmpty ? "Steady long run at easy aerobic pace" : workoutDescription,
                cooldown:  "10 min easy jog to flush out the legs",
                effortCue: "Effort 5–6 / 10  ·  Comfortable but not easy"
            )
        case .tempo:
            return WorkoutStructure(
                warmup:    "15 min easy jog + 4×20 sec accelerations",
                mainSet:   workoutDescription.isEmpty ? "Sustained tempo effort — comfortably hard" : workoutDescription,
                cooldown:  "10 min easy jog + rolling out quads and calves",
                effortCue: "Effort 7–8 / 10  ·  Comfortably hard — broken sentences only"
            )
        case .intervals:
            return WorkoutStructure(
                warmup:    "15 min easy jog + 4×20 sec strides",
                mainSet:   workoutDescription.isEmpty ? "Interval reps at hard effort with recovery jog between" : workoutDescription,
                cooldown:  "10–15 min easy jog + dynamic stretching",
                effortCue: "Effort 9 / 10 on reps  ·  Recovery jogs at effort 3–4"
            )
        case .strides:
            return WorkoutStructure(
                warmup:    "Easy run portion at conversation pace",
                mainSet:   workoutDescription.isEmpty ? "4–6 × 20 sec strides — smooth acceleration, relaxed form" : workoutDescription,
                cooldown:  "Walk / easy jog to finish",
                effortCue: "Strides at effort 8 / 10  ·  Fast but relaxed — not a sprint"
            )
        case .strength:
            return WorkoutStructure(
                warmup:    "5 min dynamic warm-up: leg swings, hip circles, arm circles",
                mainSet:   workoutDescription.isEmpty ? "Runner-specific strength circuit" : workoutDescription,
                cooldown:  "5–10 min static stretching targeting hips, hamstrings, calves",
                effortCue: "Move with control  ·  Quality over quantity on every rep"
            )
        case .mobility:
            return WorkoutStructure(
                warmup:    "2–3 min light movement to increase circulation",
                mainSet:   workoutDescription.isEmpty ? "Full-body mobility routine targeting running muscles" : workoutDescription,
                cooldown:  "Relax in any tight areas and breathe deeply",
                effortCue: "Gentle effort  ·  Never force range of motion — work to the edge of comfort"
            )
        case .rest:
            return WorkoutStructure(
                warmup:    "",
                mainSet:   "Rest day. Prioritise sleep, hydration, and a nutritious meal.",
                cooldown:  "",
                effortCue: "Recovery is where fitness is built"
            )
        }
    }
}

// MARK: - Card modifier

struct RCCard: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.rcSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

extension View {
    func rcCard(padding: CGFloat = 16) -> some View {
        modifier(RCCard(padding: padding))
    }
}

// MARK: - Section header

struct RCSectionLabel: View {
    let icon: String
    let title: String
    var color: Color = .secondary

    var body: some View {
        Label(title, systemImage: icon)
            .font(.caption.bold())
            .foregroundStyle(color)
            .textCase(.uppercase)
            .tracking(0.6)
    }
}

// MARK: - Pill badge

struct RCPill: View {
    let text: String
    var color: Color = .rcAccent

    var body: some View {
        Text(text)
            .font(.caption2.bold())
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Large primary button

struct RCPrimaryButton: View {
    let label: String
    let icon: String
    var color: Color = .rcAccent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(.white)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

// MARK: - Workout header gradient

struct WorkoutGradientHeader: View {
    let workout: WorkoutDay
    let onDismiss: () -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: workout.workoutType.gradientColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .leading, spacing: 0) {
                // Dismiss button
                HStack {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                    Spacer()
                    if workout.wasAdapted {
                        RCPill(text: "Adapted", color: .white)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer().frame(height: 24)

                // Workout type + emoji
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(workout.workoutType.emoji)
                        .font(.system(size: 48))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(workout.workoutType.label)
                            .font(.largeTitle.bold())
                            .foregroundStyle(.white)
                        Text(workout.phase.label + " Phase")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.75))
                    }
                }
                .padding(.horizontal, 20)

                Spacer().frame(height: 20)

                // Stats row
                HStack(spacing: 16) {
                    if let miles = workout.distanceMiles {
                        WorkoutStatChip(label: "Distance", value: String(format: "%.1f mi", miles))
                    }
                    if let mins = workout.durationMinutes {
                        WorkoutStatChip(label: "Duration", value: "\(mins) min")
                    }
                    WorkoutStatChip(label: "Date", value: workout.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: 0))
    }
}

struct WorkoutStatChip: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(.white)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.white.opacity(0.18))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
