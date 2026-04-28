import SwiftUI

// MARK: - Step 1: Basic Info

struct BasicInfoStep: View {
    let vm: OnboardingViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                StepHeader(title: "Tell us about yourself", subtitle: "We'll use this to set the right starting point.")

                LabeledSlider(
                    label: "Age",
                    value: Binding(get: { vm.age }, set: { vm.age = $0 }),
                    range: 13...80,
                    step: 1,
                    format: "%.0f"
                )

                VStack(alignment: .leading, spacing: 12) {
                    Text("Running experience").font(.headline)
                    ForEach(RunningAbility.allCases, id: \.self) { level in
                        SelectionCard(
                            title: level.label,
                            subtitle: level.description,
                            isSelected: vm.ability == level
                        ) { vm.ability = level }
                    }
                }

                LabeledSlider(
                    label: "Current weekly mileage",
                    value: Binding(get: { vm.weeklyMileage }, set: { vm.weeklyMileage = $0 }),
                    range: 0...80,
                    step: 1,
                    format: "%.0f mi/week"
                )

                LabeledSlider(
                    label: "Longest run in the last 4 weeks",
                    value: Binding(get: { vm.longestRun }, set: { vm.longestRun = $0 }),
                    range: 0...30,
                    step: 0.5,
                    format: "%.1f miles"
                )
            }
            .padding()
        }
    }
}

// MARK: - Step 2: Goal

struct GoalStep: View {
    let vm: OnboardingViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                StepHeader(title: "What's your goal?", subtitle: "This shapes every week of your plan.")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(RunningGoal.allCases, id: \.self) { goal in
                        GoalCard(goal: goal, isSelected: vm.goal == goal) {
                            vm.goal = goal
                        }
                    }
                }

                if vm.goal.hasRaceDistance {
                    VStack(alignment: .leading, spacing: 12) {
                        Toggle("I have a target race date", isOn: Binding(
                            get: { vm.hasGoalDate },
                            set: { vm.hasGoalDate = $0 }
                        ))
                        .font(.headline)

                        if vm.hasGoalDate {
                            DatePicker(
                                "Race date",
                                selection: Binding(get: { vm.goalDate }, set: { vm.goalDate = $0 }),
                                in: Date()...,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.compact)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding()
        }
    }
}

// MARK: - Step 3: Schedule

struct ScheduleStep: View {
    let vm: OnboardingViewModel
    private let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                StepHeader(title: "Set your schedule", subtitle: "Be realistic — consistency beats ambition.")

                LabeledSlider(
                    label: "Running days per week",
                    value: Binding(get: { vm.runningDays }, set: { vm.runningDays = $0 }),
                    range: 2...7,
                    step: 1,
                    format: "%.0f days"
                )

                VStack(alignment: .leading, spacing: 12) {
                    Text("Preferred long run day").font(.headline)
                    HStack(spacing: 8) {
                        ForEach(0..<7, id: \.self) { i in
                            Button(days[i]) {
                                vm.preferredLongRunDay = i
                            }
                            .font(.caption.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(vm.preferredLongRunDay == i ? Color.accentColor : Color(.secondarySystemGroupedBackground))
                            .foregroundStyle(vm.preferredLongRunDay == i ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }

                LabeledSlider(
                    label: "Strength training days per week",
                    value: Binding(get: { vm.strengthDays }, set: { vm.strengthDays = $0 }),
                    range: 0...3,
                    step: 1,
                    format: "%.0f days"
                )

                InfoBox(text: "Strength training days will be scheduled on your non-running days where possible.")
            }
            .padding()
        }
    }
}

// MARK: - Step 4: Injury

struct InjuryStep: View {
    let vm: OnboardingViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                StepHeader(
                    title: "Injury history",
                    subtitle: "Past injuries shape how we progress your training. Be honest — we adjust, not avoid."
                )

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(InjuryType.allCases, id: \.self) { injury in
                        let isSelected = vm.selectedInjuries.contains(injury)
                        Button {
                            toggleInjury(injury)
                        } label: {
                            Text(injury.label)
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(isSelected ? Color.accentColor.opacity(0.15) : Color(.secondarySystemGroupedBackground))
                                .foregroundStyle(isSelected ? Color.accentColor : .primary)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding()
        }
    }

    private func toggleInjury(_ injury: InjuryType) {
        if injury == .none {
            vm.selectedInjuries = [.none]
            return
        }
        vm.selectedInjuries.remove(.none)
        if vm.selectedInjuries.contains(injury) {
            vm.selectedInjuries.remove(injury)
            if vm.selectedInjuries.isEmpty { vm.selectedInjuries = [.none] }
        } else {
            vm.selectedInjuries.insert(injury)
        }
    }
}

// MARK: - Step 5: Style

struct StyleStep: View {
    let vm: OnboardingViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                StepHeader(title: "Training style", subtitle: "How fast do you want to push the load?")

                VStack(spacing: 12) {
                    ForEach(TrainingStyle.allCases, id: \.self) { style in
                        SelectionCard(
                            title: style.label,
                            subtitle: style.description,
                            isSelected: vm.trainingStyle == style
                        ) { vm.trainingStyle = style }
                    }
                }

                InfoBox(text: "When in doubt, choose Balanced. You can always regenerate your plan with a different style later.")
            }
            .padding()
        }
    }
}

// MARK: - Shared onboarding components

struct StepHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.title2.bold())
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
    }
}

struct SelectionCard: View {
    let title: String
    let subtitle: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .font(.title3)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.headline).foregroundStyle(.primary)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.accentColor.opacity(0.08) : Color(.secondarySystemGroupedBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}

struct GoalCard: View {
    let goal: RunningGoal
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Text(goal.emoji).font(.largeTitle)
                Text(goal.label).font(.subheadline.weight(.semibold)).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(isSelected ? Color.accentColor.opacity(0.12) : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? Color.accentColor : .primary)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

struct LabeledSlider: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label).font(.headline)
                Spacer()
                Text(String(format: format, value))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: range, step: step)
                .tint(.accentColor)
        }
    }
}

struct InfoBox: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(.secondary)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(.tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
