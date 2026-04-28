import SwiftUI
import SwiftData

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Today", systemImage: "figure.run") }
            WeeklyPlanView()
                .tabItem { Label("Plan", systemImage: "calendar") }
            ProgressDashboardView()
                .tabItem { Label("Progress", systemImage: "chart.bar.fill") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
    }
}

struct HomeView: View {
    @Query private var profiles: [UserProfile]
    @Query(
        filter: #Predicate<WorkoutDay> { $0.adaptationNote != nil && !$0.isCompleted },
        sort: \.date
    ) private var adaptedWorkouts: [WorkoutDay]

    private var profile: UserProfile? { profiles.first }
    private var plan: TrainingPlan? { profile?.activePlan }

    private var recentAdaptations: [WorkoutDay] {
        let tomorrow = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        )
        let horizon = Calendar.current.date(byAdding: .day, value: 7, to: tomorrow)!
        return adaptedWorkouts.filter { $0.date >= tomorrow && $0.date <= horizon }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Hero header
                    HomeHeaderView(profile: profile, plan: plan)
                        .padding(.horizontal)

                    // Adaptation banner
                    if !recentAdaptations.isEmpty {
                        HomePlanAdjustedBanner(count: recentAdaptations.count)
                            .padding(.horizontal)
                    }

                    // Today's workout
                    if let workout = plan?.todayWorkout {
                        TodayHeroCard(workout: workout)
                            .padding(.horizontal)
                    } else {
                        RestDayCard()
                            .padding(.horizontal)
                    }

                    // Week at a glance
                    if let plan {
                        WeekAtAGlance(
                            workouts: plan.currentWeekWorkouts,
                            targetMiles: plan.targetMilesThisWeek,
                            completedMiles: plan.completedMilesThisWeek
                        )
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(Color.rcBase)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("RunCoach")
                        .font(.headline.bold())
                }
            }
        }
    }
}

// MARK: - Header

private struct HomeHeaderView: View {
    let profile: UserProfile?
    let plan: TrainingPlan?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(.title2.bold())
            if let plan {
                Text("Week \(plan.currentWeekNumber) of \(plan.totalWeeks) · \(plan.currentWeekWorkouts.first?.phase.label ?? "") Phase")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                Text(Date(), format: .dateTime.weekday(.wide).month(.wide).day())
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good morning."
        case 12..<17: return "Good afternoon."
        default: return "Good evening."
        }
    }
}

// MARK: - Today hero card

struct TodayHeroCard: View {
    @Bindable var workout: WorkoutDay
    @State private var showDetail = false

    var body: some View {
        Button { showDetail = true } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Gradient header strip
                ZStack(alignment: .bottomLeading) {
                    LinearGradient(
                        colors: workout.workoutType.gradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(height: 90)

                    HStack(spacing: 10) {
                        Text(workout.workoutType.emoji)
                            .font(.title)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("TODAY")
                                .font(.caption2.bold())
                                .foregroundStyle(.white.opacity(0.8))
                                .tracking(1)
                            Text(workout.workoutType.label)
                                .font(.title3.bold())
                                .foregroundStyle(.white)
                        }
                        Spacer()
                        if workout.isCompleted {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
                }

                // Stats row
                HStack(spacing: 20) {
                    if let miles = workout.distanceMiles {
                        TodayStatPill(value: String(format: "%.1f mi", miles), label: "Distance")
                    }
                    if let mins = workout.durationMinutes {
                        TodayStatPill(value: "\(mins) min", label: "Duration")
                    }
                    TodayStatPill(value: workout.phase.label, label: "Phase")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                // Description preview
                Text(workout.workoutDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
            }
            .background(Color.rcSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: workout.workoutType.accentColor.opacity(0.15), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showDetail) {
            TodayWorkoutView(workout: workout)
        }
    }
}

private struct TodayStatPill: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.bold())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}

// MARK: - Rest day card

struct RestDayCard: View {
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "moon.zzz.fill")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Rest Day")
                    .font(.headline)
                Text("No workout today. Recover, hydrate, and sleep well.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(20)
        .background(Color.rcSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

// MARK: - Week at a glance

struct WeekAtAGlance: View {
    let workouts: [WorkoutDay]
    let targetMiles: Double
    let completedMiles: Double
    private let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("This Week")
                    .font(.headline)
                Spacer()
                Text(String(format: "%.1f / %.0f mi", completedMiles, targetMiles))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.rcTertiary)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.rcAccent)
                        .frame(width: targetMiles > 0 ? geo.size.width * min(completedMiles / targetMiles, 1) : 0)
                }
            }
            .frame(height: 6)

            // Day dots
            HStack(spacing: 0) {
                ForEach(workouts.sorted { $0.dayOfWeek < $1.dayOfWeek }) { workout in
                    VStack(spacing: 6) {
                        Text(dayLetters[workout.dayOfWeek])
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        ZStack {
                            Circle()
                                .fill(dotFill(workout))
                                .frame(width: 34, height: 34)
                            dotContent(workout)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .rcCard()
    }

    private func dotFill(_ w: WorkoutDay) -> Color {
        if w.isCompleted { return .green }
        if w.isSkipped   { return Color.secondary.opacity(0.3) }
        if w.isToday     { return w.workoutType.accentColor }
        if w.isPast      { return Color.orange.opacity(0.5) }
        return Color.rcTertiary
    }

    @ViewBuilder
    private func dotContent(_ w: WorkoutDay) -> some View {
        if w.isCompleted {
            Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(.white)
        } else if w.isSkipped {
            Image(systemName: "xmark").font(.caption).foregroundStyle(.white)
        } else if w.workoutType == .rest || w.workoutType == .mobility {
            Text("—").font(.caption).foregroundStyle(.secondary)
        } else {
            Text(w.workoutType.emoji).font(.caption)
        }
    }
}

// MARK: - Adaptation banner

struct HomePlanAdjustedBanner: View {
    let count: Int

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("Plan adjusted")
                    .font(.subheadline.bold())
                Text("\(count) upcoming workout\(count == 1 ? "" : "s") modified based on your check-in.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .background(Color.orange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.orange.opacity(0.2), lineWidth: 1))
    }
}

// MARK: - Legacy TodayCard (still used from WorkoutDetailView sheet)

struct TodayCard: View {
    @Bindable var workout: WorkoutDay
    @State private var showDetail = false

    var body: some View {
        TodayHeroCard(workout: workout)
    }
}

struct NoWorkoutCard: View {
    var body: some View {
        RestDayCard()
    }
}

// MARK: - WeekMiniView alias (used in older code paths)

struct WeekMiniView: View {
    let workouts: [WorkoutDay]
    let targetMiles: Double
    let completedMiles: Double

    var body: some View {
        WeekAtAGlance(workouts: workouts, targetMiles: targetMiles, completedMiles: completedMiles)
    }
}
