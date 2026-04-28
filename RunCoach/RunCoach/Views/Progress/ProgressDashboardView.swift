import SwiftUI
import SwiftData
import Charts

struct ProgressDashboardView: View {
    @Query private var profiles: [UserProfile]
    @Query(sort: \WorkoutDay.date) private var allWorkouts: [WorkoutDay]

    private var profile: UserProfile? { profiles.first }
    private var plan: TrainingPlan? { profile?.activePlan }

    // Last 8 weeks of completed workouts for chart
    private var weeksData: [WeekSummary] {
        guard let plan else { return [] }
        let maxWeek = min(plan.currentWeekNumber, plan.totalWeeks)
        let startWeek = max(1, maxWeek - 7)
        return (startWeek...maxWeek).map { week in
            let workouts = allWorkouts.filter { $0.weekNumber == week }
            let completed = workouts.filter { $0.isCompleted }
            let miles = completed.compactMap(\.distanceMiles).reduce(0, +)
            let target = plan.weeklyMileage(forWeek: week)
            return WeekSummary(week: week, miles: miles, targetMiles: target, completedCount: completed.count, totalCount: workouts.filter { $0.workoutType != .rest }.count)
        }
    }

    private var totalMilesCompleted: Double {
        allWorkouts.filter { $0.isCompleted }.compactMap(\.distanceMiles).reduce(0, +)
    }

    private var workoutsCompleted: Int {
        allWorkouts.filter { $0.isCompleted }.count
    }

    private var currentStreak: Int {
        // Count consecutive weeks (from current backwards) with at least 1 completed workout.
        guard let plan else { return 0 }
        var streak = 0
        var week = plan.currentWeekNumber
        while week >= 1 {
            let completed = allWorkouts.filter { $0.weekNumber == week && $0.isCompleted }
            if completed.isEmpty { break }
            streak += 1
            week -= 1
        }
        return streak
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if plan == nil {
                        ContentUnavailableView(
                            "No Plan Yet",
                            systemImage: "chart.bar.xaxis",
                            description: Text("Complete onboarding to start tracking your progress.")
                        )
                        .padding(.top, 60)
                    } else {
                        statsRow
                        weeklyChart
                        workoutBreakdown
                        recentActivityList
                    }
                }
                .padding()
            }
            .background(Color.rcBase)
            .navigationTitle("Progress")
        }
    }

    // MARK: - Stats row

    private var statsRow: some View {
        HStack(spacing: 12) {
            StatCard(value: String(format: "%.0f", totalMilesCompleted), label: "Total Miles", icon: "figure.run", color: .rcAccent)
            StatCard(value: "\(workoutsCompleted)", label: "Workouts Done", icon: "checkmark.circle.fill", color: .green)
            StatCard(value: "\(currentStreak)w", label: "Streak", icon: "flame.fill", color: .orange)
        }
    }

    // MARK: - Weekly mileage bar chart

    private var weeklyChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            RCSectionLabel(icon: "chart.bar.fill", title: "Weekly Mileage", color: .rcAccent)

            if weeksData.isEmpty {
                Text("No data yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .center)
            } else {
                Chart {
                    ForEach(weeksData) { week in
                        BarMark(
                            x: .value("Week", "W\(week.week)"),
                            y: .value("Miles", week.miles)
                        )
                        .foregroundStyle(
                            week.miles >= week.targetMiles * 0.80
                                ? Color.rcAccent.gradient
                                : Color.secondary.opacity(0.3).gradient
                        )
                        .cornerRadius(4)

                        // Target line as rule mark overlay
                        if week.targetMiles > 0 {
                            RuleMark(y: .value("Target", week.targetMiles))
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                                .foregroundStyle(.secondary.opacity(0.4))
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 160)
            }
        }
        .rcCard()
    }

    // MARK: - Workout type breakdown

    private var workoutBreakdown: some View {
        let typeCounts = Dictionary(
            grouping: allWorkouts.filter { $0.isCompleted && $0.workoutType != .rest },
            by: \.workoutType
        ).mapValues(\.count)

        return VStack(alignment: .leading, spacing: 12) {
            RCSectionLabel(icon: "square.grid.2x2.fill", title: "Workout Breakdown", color: .purple)

            if typeCounts.isEmpty {
                Text("Complete your first workout to see a breakdown.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                let sorted = typeCounts.sorted { $0.value > $1.value }
                VStack(spacing: 8) {
                    ForEach(sorted, id: \.key) { type, count in
                        HStack(spacing: 10) {
                            Text(type.emoji).frame(width: 24)
                            Text(type.label)
                                .font(.subheadline)
                            Spacer()
                            Text("\(count)")
                                .font(.subheadline.monospacedDigit().bold())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .rcCard()
    }

    // MARK: - Recent activity

    private var recentActivityList: some View {
        let recent = allWorkouts
            .filter { $0.isCompleted }
            .sorted { $0.date > $1.date }
            .prefix(10)

        return VStack(alignment: .leading, spacing: 12) {
            RCSectionLabel(icon: "clock.fill", title: "Recent Activity", color: .blue)

            if recent.isEmpty {
                Text("No completed workouts yet. Go crush one!")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(recent)) { workout in
                        RecentActivityRow(workout: workout)
                        if workout.id != recent.last?.id {
                            Divider().padding(.leading, 40)
                        }
                    }
                }
            }
        }
        .rcCard()
    }
}

// MARK: - Supporting views

private struct StatCard: View {
    let value: String
    let label: String
    let icon: String
    var color: Color = .rcAccent

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text(value)
                .font(.title2.bold().monospacedDigit())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.rcSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct RecentActivityRow: View {
    let workout: WorkoutDay

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(workout.workoutType.accentColor.opacity(0.12))
                    .frame(width: 34, height: 34)
                Text(workout.workoutType.emoji)
                    .font(.subheadline)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(workout.workoutType.label)
                    .font(.subheadline.weight(.medium))
                Text(workout.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let miles = workout.distanceMiles {
                Text(String(format: "%.1f mi", miles))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Data model

private struct WeekSummary: Identifiable {
    let week: Int
    let miles: Double
    let targetMiles: Double
    let completedCount: Int
    let totalCount: Int

    var id: Int { week }
}
