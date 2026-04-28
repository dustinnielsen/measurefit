import SwiftUI
import SwiftData

struct WorkoutDetailView: View {
    @Bindable var workout: WorkoutDay
    @Environment(\.dismiss) private var dismiss
    @Query private var profiles: [UserProfile]

    @State private var showNoteField = false
    @State private var noteText = ""
    @State private var showCheckIn = false

    private var experienceLevel: ExperienceLevel {
        profiles.first?.planInput.experienceLevel ?? .beginner
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .center, spacing: 12) {
                            Text(workout.workoutType.emoji).font(.largeTitle)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(workout.workoutType.label).font(.title2.bold())
                                Text(dateString).font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            StatusBadge(workout: workout)
                        }

                        HStack(spacing: 12) {
                            if let miles = workout.distanceMiles {
                                StatPill(label: "Distance", value: String(format: "%.1f mi", miles))
                            }
                            if let mins = workout.durationMinutes {
                                StatPill(label: "Duration", value: "\(mins) min")
                            }
                            StatPill(label: "Phase", value: workout.phase.label)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Adaptation banner — shown when the engine modified this day
                    if workout.wasAdapted, let note = workout.adaptationNote {
                        AdaptationBanner(
                            note: note,
                            originalType: workout.preAdaptType,
                            originalDistance: workout.preAdaptDistance
                        )
                    }

                    // Instructions
                    SectionCard(title: "How to do it") {
                        Text(workout.workoutDescription).font(.body)
                    }

                    // Coaching notes
                    SectionCard(title: "Why this workout") {
                        Text(workout.coachingNotes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }

                    // User notes
                    if let notes = workout.userNotes, !notes.isEmpty {
                        SectionCard(title: "Your Notes") {
                            Text(notes).font(.body).foregroundStyle(.secondary)
                        }
                    }

                    if showNoteField {
                        SectionCard(title: "Add Note") {
                            TextField("How did it go?", text: $noteText, axis: .vertical)
                                .lineLimit(3...6)
                            Button("Save Note") {
                                workout.userNotes = noteText
                                showNoteField = false
                            }
                            .buttonStyle(.bordered)
                        }
                    }

                    // Actions
                    VStack(spacing: 12) {
                        if !workout.isCompleted && !workout.isSkipped {
                            if workout.workoutType.isRun {
                                // Run workouts → trigger check-in after marking complete.
                                Button {
                                    workout.isCompleted = true
                                    workout.completedAt = Date()
                                    showCheckIn = true
                                } label: {
                                    Label("Mark as Complete", systemImage: "checkmark.circle.fill")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.green)
                                .controlSize(.large)
                            } else {
                                // Non-run workouts (strength, mobility) — complete without check-in.
                                Button {
                                    workout.isCompleted = true
                                    workout.completedAt = Date()
                                    dismiss()
                                } label: {
                                    Label("Mark as Complete", systemImage: "checkmark.circle.fill")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.green)
                                .controlSize(.large)
                            }

                            Button {
                                workout.isSkipped = true
                                dismiss()
                            } label: {
                                Label("Skip This Workout", systemImage: "forward.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.secondary)

                        } else if workout.isCompleted {
                            // Already done — allow undo, and offer check-in if not yet done.
                            if workout.workoutType.isRun {
                                Button {
                                    showCheckIn = true
                                } label: {
                                    Label("Update Check-In", systemImage: "chart.bar.fill")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                .tint(.accentColor)
                            }

                            Button {
                                workout.isCompleted = false
                                workout.completedAt = nil
                            } label: {
                                Label("Undo Complete", systemImage: "arrow.uturn.left")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.secondary)

                        } else if workout.isSkipped {
                            Button {
                                workout.isSkipped = false
                            } label: {
                                Label("Undo Skip", systemImage: "arrow.uturn.left")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.secondary)
                        }

                        if !showNoteField {
                            Button("Add Note") {
                                noteText = workout.userNotes ?? ""
                                showNoteField = true
                            }
                            .buttonStyle(.borderless)
                            .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
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
    }

    private var dateString: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d"
        return f.string(from: workout.date)
    }
}

// MARK: - Adaptation banner

struct AdaptationBanner: View {
    let note: String
    let originalType: WorkoutType?
    let originalDistance: Double?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.subheadline.bold())
                .foregroundStyle(.orange)
                .padding(.top, 1)

            VStack(alignment: .leading, spacing: 4) {
                Text("Plan adjusted")
                    .font(.subheadline.bold())
                    .foregroundStyle(.orange)

                if let orig = originalType {
                    HStack(spacing: 4) {
                        Text("Was: \(orig.label)")
                            .strikethrough()
                        if let d = originalDistance {
                            Text("(\(String(format: "%.1f", d)) mi)")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Text(note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.orange.opacity(0.25), lineWidth: 1)
        )
    }
}

// MARK: - Subcomponents (shared with other plan views)

struct StatusBadge: View {
    let workout: WorkoutDay

    var body: some View {
        if workout.isCompleted {
            Label("Done", systemImage: "checkmark.circle.fill")
                .font(.caption.bold()).foregroundStyle(.green)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Color.green.opacity(0.12)).clipShape(Capsule())
        } else if workout.isSkipped {
            Label("Skipped", systemImage: "forward.fill")
                .font(.caption.bold()).foregroundStyle(.secondary)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Color.secondary.opacity(0.12)).clipShape(Capsule())
        } else if workout.isToday {
            Text("TODAY")
                .font(.caption.bold()).foregroundStyle(.accentColor)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Color.accentColor.opacity(0.12)).clipShape(Capsule())
        }
    }
}

struct StatPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.bold())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Color(.tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            content
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// WorkoutType.isRun is defined in Enums.swift and available via @testable import.
