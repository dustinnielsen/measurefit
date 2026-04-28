import SwiftUI
import SwiftData

struct WeeklyPlanView: View {
    @Query private var profiles: [UserProfile]
    @State private var selectedWeek: Int = 0  // 0 = current week
    @State private var showFullPlan = false

    private var profile: UserProfile? { profiles.first }
    private var plan: TrainingPlan? { profile?.activePlan }
    private var displayWeek: Int { selectedWeek == 0 ? (plan?.currentWeekNumber ?? 1) : selectedWeek }

    var body: some View {
        NavigationStack {
            Group {
                if let plan {
                    ScrollView {
                        VStack(spacing: 20) {
                            WeekSelector(
                                currentWeek: displayWeek,
                                totalWeeks: plan.totalWeeks,
                                onPrev: { if displayWeek > 1 { selectedWeek = displayWeek - 1 } },
                                onNext: { if displayWeek < plan.totalWeeks { selectedWeek = displayWeek + 1 } }
                            )

                            WeekSummaryBar(
                                phase: plan.workouts(forWeek: displayWeek).first?.phase ?? .base,
                                miles: plan.weeklyMileage(forWeek: displayWeek)
                            )

                            VStack(spacing: 10) {
                                ForEach(plan.workouts(forWeek: displayWeek)) { workout in
                                    WorkoutRow(workout: workout)
                                }
                            }
                            .padding(.horizontal)

                            Button("View Full Plan") { showFullPlan = true }
                                .buttonStyle(.bordered)
                                .padding(.bottom, 8)
                        }
                        .padding(.vertical)
                    }
                } else {
                    ContentUnavailableView("No Plan Yet", systemImage: "calendar.badge.exclamationmark", description: Text("Complete onboarding to generate your training plan."))
                }
            }
            .navigationTitle("Training Plan")
            .sheet(isPresented: $showFullPlan) {
                if let plan { FullPlanView(plan: plan) }
            }
        }
    }
}

struct WeekSelector: View {
    let currentWeek: Int
    let totalWeeks: Int
    let onPrev: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack {
            Button(action: onPrev) {
                Image(systemName: "chevron.left")
                    .font(.title3.bold())
                    .foregroundStyle(currentWeek > 1 ? .primary : .tertiary)
            }
            .disabled(currentWeek <= 1)

            Spacer()

            VStack(spacing: 2) {
                Text("Week \(currentWeek) of \(totalWeeks)")
                    .font(.headline)
            }

            Spacer()

            Button(action: onNext) {
                Image(systemName: "chevron.right")
                    .font(.title3.bold())
                    .foregroundStyle(currentWeek < totalWeeks ? .primary : .tertiary)
            }
            .disabled(currentWeek >= totalWeeks)
        }
        .padding(.horizontal)
    }
}

struct WeekSummaryBar: View {
    let phase: TrainingPhase
    let miles: Double

    var body: some View {
        HStack(spacing: 16) {
            Label(phase.label, systemImage: "flag.fill")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
            Spacer()
            Text(String(format: "%.0f miles", miles))
                .font(.subheadline.weight(.semibold))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal)
    }
}

struct WorkoutRow: View {
    @Bindable var workout: WorkoutDay
    @State private var showDetail = false
    private let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        HStack(spacing: 14) {
            // Day label
            VStack(spacing: 2) {
                Text(dayNames[workout.dayOfWeek])
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                Text(dayOfMonth)
                    .font(.subheadline.monospacedDigit())
            }
            .frame(width: 32)

            // Type dot
            Circle()
                .fill(typeColor)
                .frame(width: 10, height: 10)

            // Workout info
            VStack(alignment: .leading, spacing: 2) {
                Text(workout.workoutType.label).font(.subheadline.weight(.medium))
                Text(workout.summaryLine).font(.caption).foregroundStyle(.secondary)
            }

            Spacer()

            // Status
            statusIcon
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture { showDetail = true }
        .sheet(isPresented: $showDetail) {
            WorkoutDetailView(workout: workout)
        }
    }

    private var dayOfMonth: String {
        let f = DateFormatter()
        f.dateFormat = "d"
        return f.string(from: workout.date)
    }

    private var typeColor: Color {
        switch workout.workoutType {
        case .easy: return .green
        case .long: return .blue
        case .tempo: return .orange
        case .intervals: return .red
        case .strides: return .teal
        case .strength: return .purple
        case .mobility: return .mint
        case .rest: return .gray.opacity(0.4)
        }
    }

    @ViewBuilder
    private var statusIcon: some View {
        if workout.isCompleted {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
        } else if workout.isSkipped {
            Image(systemName: "minus.circle.fill").foregroundStyle(.gray)
        } else if workout.isToday {
            Image(systemName: "circle.fill").foregroundStyle(.accentColor)
        } else {
            Image(systemName: "circle").foregroundStyle(.tertiary)
        }
    }
}

struct FullPlanView: View {
    let plan: TrainingPlan
    @State private var expandedWeek: Int? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(1...plan.totalWeeks, id: \.self) { week in
                    let phase = plan.workouts(forWeek: week).first?.phase ?? .base
                    let miles = plan.weeklyMileage(forWeek: week)
                    let isDeload = week % 4 == 0

                    Section {
                        if expandedWeek == week {
                            ForEach(plan.workouts(forWeek: week)) { workout in
                                HStack {
                                    Text(workout.workoutType.emoji)
                                    Text(workout.workoutType.label)
                                        .font(.subheadline)
                                    Spacer()
                                    Text(workout.summaryLine)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    } header: {
                        Button {
                            withAnimation { expandedWeek = expandedWeek == week ? nil : week }
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text("Week \(week)").font(.subheadline.bold()).foregroundStyle(.primary)
                                        if isDeload {
                                            Text("RECOVERY").font(.caption2.bold()).foregroundStyle(.orange)
                                                .padding(.horizontal, 5).padding(.vertical, 2)
                                                .background(Color.orange.opacity(0.1))
                                                .clipShape(Capsule())
                                        }
                                    }
                                    Text("\(phase.label) · \(String(format: "%.0f", miles)) mi")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: expandedWeek == week ? "chevron.up" : "chevron.down")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Full Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
