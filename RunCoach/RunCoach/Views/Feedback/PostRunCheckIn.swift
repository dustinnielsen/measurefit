import SwiftUI
import SwiftData

// MARK: - Entry point

struct PostRunCheckIn: View {
    let workout: WorkoutDay
    let experienceLevel: ExperienceLevel
    let onDone: () -> Void

    @State private var vm = CheckInViewModel()
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()

                switch vm.phase {
                case .form:
                    CheckInFormView(vm: vm, workout: workout) {
                        vm.submit(
                            workout: workout,
                            experienceLevel: experienceLevel,
                            modelContext: modelContext
                        )
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom),
                        removal: .opacity
                    ))

                case .processing:
                    ProcessingView()
                        .transition(.opacity)

                case .result:
                    if let result = vm.result {
                        AdaptationResultView(result: result, onDone: onDone)
                            .transition(.asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .opacity
                            ))
                    }
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: vm.phase)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if vm.phase == .form {
                        Button("Skip") { onDone() }
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Check-in form

private struct CheckInFormView: View {
    let vm: CheckInViewModel
    let workout: WorkoutDay
    let onSubmit: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {

                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("How did that go?")
                        .font(.title2.bold())
                    Text("\(workout.workoutType.emoji)  \(workout.workoutDescription)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // 1. Completion
                CheckInSection(title: "Did you complete it?") {
                    HStack(spacing: 10) {
                        ForEach(CompletionStatus.allCases, id: \.self) { status in
                            CompletionChip(
                                status: status,
                                isSelected: vm.completionStatus == status
                            ) { vm.completionStatus = status }
                        }
                    }
                }

                // 2. Effort
                CheckInSection(title: "Effort") {
                    VStack(alignment: .leading, spacing: 10) {
                        EffortSelector(rating: Binding(
                            get: { vm.effortRating },
                            set: { vm.effortRating = $0 }
                        ))
                        HStack {
                            Text(vm.effortLabel)
                                .font(.subheadline.bold())
                                .foregroundStyle(.primary)
                            Text("·  \(vm.effortSubtitle)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // 3. Pain
                CheckInSection(title: "Any pain or discomfort?") {
                    HStack(spacing: 8) {
                        ForEach(PainLevel.allCases, id: \.self) { level in
                            PainChip(
                                level: level,
                                isSelected: vm.painLevel == level
                            ) { vm.painLevel = level }
                        }
                    }
                    if vm.painLevel == .sharp {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.octagon.fill")
                                .foregroundStyle(.red)
                            Text("Sharp pain warrants stopping. All speed work will be removed from the next 7 days.")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                        .padding(10)
                        .background(Color.red.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                // 4. Energy
                CheckInSection(title: "Energy level") {
                    HStack(spacing: 10) {
                        ForEach(EnergyLevel.allCases, id: \.self) { level in
                            ThreeWayChip(
                                label: level.label,
                                icon: level.icon,
                                isSelected: vm.energyLevel == level
                            ) { vm.energyLevel = level }
                        }
                    }
                }

                // 5. Sleep
                CheckInSection(title: "How did you sleep last night?") {
                    HStack(spacing: 10) {
                        ForEach(SleepQuality.allCases, id: \.self) { quality in
                            ThreeWayChip(
                                label: quality.label,
                                icon: quality.icon,
                                isSelected: vm.sleepQuality == quality
                            ) { vm.sleepQuality = quality }
                        }
                    }
                }

                // Submit
                Button {
                    onSubmit()
                } label: {
                    Text("Save & Check Plan")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.bottom, 8)
            }
            .padding()
        }
    }
}

// MARK: - Processing

private struct ProcessingView: View {
    @State private var dots = 0
    let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.4)
            Text("Analysing your signals" + String(repeating: ".", count: dots))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 220, alignment: .leading)
        }
        .onReceive(timer) { _ in
            dots = (dots + 1) % 4
        }
    }
}

// MARK: - Result

struct AdaptationResultView: View {
    let result: AdaptationResult
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {

                // Status header
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(headerColor.opacity(0.15))
                            .frame(width: 56, height: 56)
                        Image(systemName: headerIcon)
                            .font(.title2)
                            .foregroundStyle(headerColor)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(result.signalLevel.label)
                            .font(.title3.bold())
                        Text("Based on your last 7 days")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))

                // Signal summary
                SignalSummaryCard(signals: result.signals)

                // Messages
                if !result.messages.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(result.messages) { msg in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: msg.icon)
                                    .foregroundStyle(msg.isCritical ? .red : .secondary)
                                    .frame(width: 20)
                                Text(msg.text)
                                    .font(.subheadline)
                                    .foregroundStyle(msg.isCritical ? .primary : .secondary)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                // Specific adjustments
                if !result.adjustments.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Plan changes")
                            .font(.headline)

                        ForEach(result.adjustments) { adj in
                            AdjustmentRow(adjustment: adj)
                        }
                    }
                }

                // Medical attention callout
                if result.requiresMedicalAttention {
                    HStack(spacing: 12) {
                        Image(systemName: "cross.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Consider seeing a professional")
                                .font(.subheadline.bold())
                            Text("Sharp pain during exercise should be assessed by a doctor or physio if it doesn't resolve within 48 hours.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(Color.red.opacity(0.3), lineWidth: 1)
                    )
                }

                Button("Got it") { onDone() }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .controlSize(.large)
                    .padding(.bottom, 8)
            }
            .padding()
        }
    }

    private var headerColor: Color {
        switch result.signalLevel {
        case .ok:      return .green
        case .caution: return .yellow
        case .concern: return .orange
        case .danger:  return .red
        }
    }

    private var headerIcon: String {
        switch result.signalLevel {
        case .ok:      return "checkmark.circle.fill"
        case .caution: return "arrow.down.circle.fill"
        case .concern: return "exclamationmark.triangle.fill"
        case .danger:  return "xmark.octagon.fill"
        }
    }
}

private struct SignalSummaryCard: View {
    let signals: AdaptationSignals

    var body: some View {
        HStack(spacing: 0) {
            SignalPill(
                label: "Pain",
                value: signals.worstPain.label,
                color: painColor
            )
            Divider().frame(height: 36)
            SignalPill(
                label: "Fatigue",
                value: fatigueLabel,
                color: fatigueColor
            )
            Divider().frame(height: 36)
            SignalPill(
                label: "Completion",
                value: "\(Int(signals.completionRate * 100))%",
                color: completionColor
            )
        }
        .padding(.vertical, 12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var painColor: Color {
        switch signals.worstPain {
        case .none: return .green
        case .mild: return .yellow
        case .moderate: return .orange
        case .sharp: return .red
        }
    }
    private var fatigueLabel: String {
        switch signals.fatigue {
        case .fresh:  return "Fresh"
        case .normal: return "Normal"
        case .tired:  return "Tired"
        case .high:   return "High"
        }
    }
    private var fatigueColor: Color {
        switch signals.fatigue {
        case .fresh, .normal: return .green
        case .tired: return .yellow
        case .high: return .red
        }
    }
    private var completionColor: Color {
        signals.completionRate >= 0.8 ? .green : signals.completionRate >= 0.5 ? .yellow : .red
    }
}

private struct SignalPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline.bold()).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AdjustmentRow: View {
    let adjustment: WorkoutAdjustment

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Arrow
            VStack {
                Image(systemName: "arrow.right.circle.fill")
                    .foregroundStyle(.orange)
            }
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                // Before → After
                HStack(spacing: 6) {
                    Text(adjustment.originalType.label)
                        .font(.caption)
                        .strikethrough()
                        .foregroundStyle(.secondary)
                    Image(systemName: "arrow.right")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(adjustment.newType.label)
                        .font(.caption.bold())
                        .foregroundStyle(.primary)
                }
                Text(adjustment.newTitle)
                    .font(.subheadline)
                Text(adjustment.adaptationNote)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Form components

private struct CheckInSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline)
            content
        }
    }
}

private struct CompletionChip: View {
    let status: CompletionStatus
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: status.icon)
                    .font(.subheadline)
                Text(status.label)
                    .font(.subheadline.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? selectedBg : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? selectedFg : .primary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(isSelected ? selectedBorder : .clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    private var selectedBg: Color {
        switch status {
        case .completed: return .green.opacity(0.12)
        case .partial:   return .yellow.opacity(0.12)
        case .skipped:   return .gray.opacity(0.12)
        }
    }
    private var selectedFg: Color {
        switch status {
        case .completed: return .green
        case .partial:   return .yellow
        case .skipped:   return .secondary
        }
    }
    private var selectedBorder: Color { selectedFg }
}

private struct EffortSelector: View {
    @Binding var rating: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(1...10, id: \.self) { n in
                Button {
                    rating = n
                } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(n <= rating ? effortColor(n) : Color(.tertiarySystemGroupedBackground))
                            .frame(height: 36)
                        Text("\(n)")
                            .font(.caption.bold())
                            .foregroundStyle(n <= rating ? .white : .secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func effortColor(_ n: Int) -> Color {
        switch n {
        case 1...3: return .green
        case 4...6: return .yellow
        case 7...8: return .orange
        default:    return .red
        }
    }
}

private struct PainChip: View {
    let level: PainLevel
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: level.icon)
                    .font(.title3)
                Text(level.label)
                    .font(.caption.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? chipColor.opacity(0.15) : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? chipColor : .secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(isSelected ? chipColor : .clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    private var chipColor: Color {
        switch level {
        case .none:     return .green
        case .mild:     return .yellow
        case .moderate: return .orange
        case .sharp:    return .red
        }
    }
}

private struct ThreeWayChip: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(label)
                    .font(.caption.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? Color.accentColor.opacity(0.12) : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? Color.accentColor : .secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
