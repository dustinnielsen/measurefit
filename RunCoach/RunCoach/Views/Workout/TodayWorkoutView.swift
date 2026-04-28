import SwiftUI
import SwiftData

// Full-screen workout view launched from the Today card or Plan.
// Shows warmup / main set / cooldown / effort target / coaching note
// with a Start button that activates an elapsed-time timer.

struct TodayWorkoutView: View {
    @Bindable var workout: WorkoutDay
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query private var profiles: [UserProfile]

    @State private var isRunning = false
    @State private var elapsedSeconds = 0
    @State private var timer: Timer?
    @State private var showCheckIn = false
    @State private var showCompleteConfirm = false

    private var experienceLevel: ExperienceLevel {
        profiles.first?.planInput.experienceLevel ?? .beginner
    }

    private var structure: WorkoutStructure { workout.derivedStructure }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.rcBase.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Gradient header
                    WorkoutGradientHeader(workout: workout, onDismiss: { dismiss() })

                    VStack(spacing: 16) {
                        // Adaptation banner
                        if workout.wasAdapted, let note = workout.adaptationNote {
                            AdaptationBanner(
                                note: note,
                                originalType: workout.preAdaptType,
                                originalDistance: workout.preAdaptDistance
                            )
                        }

                        // Timer card (shown when active)
                        if isRunning {
                            TimerCard(elapsed: elapsedSeconds)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        // Warmup
                        if !structure.warmup.isEmpty {
                            WorkoutPhaseCard(
                                icon: "flame.fill",
                                title: "Warm-Up",
                                body: structure.warmup,
                                color: .orange
                            )
                        }

                        // Main set
                        WorkoutPhaseCard(
                            icon: "figure.run",
                            title: "Main Set",
                            body: structure.mainSet,
                            color: workout.workoutType.accentColor
                        )

                        // Cooldown
                        if !structure.cooldown.isEmpty {
                            WorkoutPhaseCard(
                                icon: "wind",
                                title: "Cool-Down",
                                body: structure.cooldown,
                                color: .teal
                            )
                        }

                        // Effort target
                        EffortTargetCard(cue: structure.effortCue, type: workout.workoutType)

                        // Coaching note
                        if !workout.coachingNotes.isEmpty {
                            CoachingNoteCard(text: workout.coachingNotes)
                        }

                        // Spacer so content clears the bottom button bar
                        Spacer().frame(height: 100)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                }
            }
            .ignoresSafeArea(edges: .top)

            // Bottom action bar
            BottomActionBar(
                workout: workout,
                isRunning: isRunning,
                onStart: startWorkout,
                onPause: pauseWorkout,
                onComplete: {
                    if workout.workoutType.isRun {
                        showCompleteConfirm = true
                    } else {
                        markComplete()
                    }
                }
            )
        }
        .sheet(isPresented: $showCheckIn) {
            PostRunCheckIn(
                workout: workout,
                experienceLevel: experienceLevel,
                onDone: {
                    showCheckIn = false
                    dismiss()
                }
            )
        }
        .confirmationDialog(
            "Mark as complete?",
            isPresented: $showCompleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Mark Complete") { markComplete() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will save your run and open the post-run check-in.")
        }
        .onDisappear { stopTimer() }
    }

    // MARK: - Timer

    private func startWorkout() {
        withAnimation(.spring(response: 0.4)) { isRunning = true }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsedSeconds += 1
        }
    }

    private func pauseWorkout() {
        withAnimation { isRunning = false }
        stopTimer()
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func markComplete() {
        stopTimer()
        workout.isCompleted = true
        workout.completedAt = Date()
        if workout.workoutType.isRun {
            showCheckIn = true
        } else {
            dismiss()
        }
    }
}

// MARK: - Phase card

private struct WorkoutPhaseCard: View {
    let icon: String
    let title: String
    let body: String
    var color: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RCSectionLabel(icon: icon, title: title, color: color)
            Text(body)
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .rcCard()
    }
}

// MARK: - Effort target card

private struct EffortTargetCard: View {
    let cue: String
    let type: WorkoutType

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(type.accentColor.opacity(0.12))
                    .frame(width: 44, height: 44)
                Image(systemName: "speedometer")
                    .font(.title3)
                    .foregroundStyle(type.accentColor)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("Effort Target")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.6)
                Text(cue)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
            }
        }
        .rcCard()
    }
}

// MARK: - Coaching note card

private struct CoachingNoteCard: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RCSectionLabel(icon: "quote.bubble.fill", title: "Coach's Note", color: .purple)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .rcCard()
    }
}

// MARK: - Timer card

private struct TimerCard: View {
    let elapsed: Int

    private var formatted: String {
        let h = elapsed / 3600
        let m = (elapsed % 3600) / 60
        let s = elapsed % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    var body: some View {
        HStack {
            Image(systemName: "timer")
                .foregroundStyle(.rcAccent)
            Text("In progress")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(formatted)
                .font(.title3.monospacedDigit().bold())
                .foregroundStyle(.primary)
        }
        .rcCard(padding: 14)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.rcAccent.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Bottom action bar

private struct BottomActionBar: View {
    let workout: WorkoutDay
    let isRunning: Bool
    let onStart: () -> Void
    let onPause: () -> Void
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            if workout.isCompleted {
                Text("Workout complete")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if workout.isSkipped {
                Text("Workout skipped")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                if isRunning {
                    HStack(spacing: 12) {
                        Button(action: onPause) {
                            Label("Pause", systemImage: "pause.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .foregroundStyle(.primary)
                                .background(Color.rcSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        Button(action: onComplete) {
                            Label("Done", systemImage: "checkmark.circle.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .foregroundStyle(.white)
                                .background(Color.green)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                    }
                } else {
                    RCPrimaryButton(
                        label: "Start Workout",
                        icon: "play.fill",
                        color: workout.workoutType.accentColor,
                        action: onStart
                    )
                    Button(action: onComplete) {
                        Label("Mark Complete Without Timer", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(.ultraThinMaterial)
    }
}
