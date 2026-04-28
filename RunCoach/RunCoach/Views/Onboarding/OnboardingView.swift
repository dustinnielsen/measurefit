import SwiftUI
import SwiftData

struct OnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var vm = OnboardingViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()

                if vm.isGenerating || vm.generationComplete {
                    GeneratingView(complete: vm.generationComplete)
                        .transition(.opacity)
                } else {
                    VStack(spacing: 0) {
                        // Progress dots
                        StepDotsView(current: vm.currentStep, total: vm.totalSteps)
                            .padding(.top, 16)
                            .padding(.bottom, 8)

                        // Step content
                        TabView(selection: $vm.currentStep) {
                            BasicInfoStep(vm: vm).tag(0)
                            GoalStep(vm: vm).tag(1)
                            ScheduleStep(vm: vm).tag(2)
                            InjuryStep(vm: vm).tag(3)
                            StyleStep(vm: vm).tag(4)
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                        .animation(.easeInOut, value: vm.currentStep)

                        // Navigation buttons
                        OnboardingNavButtons(vm: vm) {
                            vm.generatePlan(modelContext: modelContext)
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 32)
                    }
                }
            }
        }
    }
}

struct StepDotsView: View {
    let current: Int
    let total: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<total, id: \.self) { i in
                Circle()
                    .fill(i == current ? Color.accentColor : Color.secondary.opacity(0.3))
                    .frame(width: i == current ? 10 : 6, height: i == current ? 10 : 6)
                    .animation(.spring(response: 0.3), value: current)
            }
        }
    }
}

struct OnboardingNavButtons: View {
    let vm: OnboardingViewModel
    let onFinish: () -> Void

    var body: some View {
        HStack {
            if vm.currentStep > 0 {
                Button("Back") { vm.back() }
                    .buttonStyle(.bordered)
                    .tint(.secondary)
            }
            Spacer()
            if vm.currentStep < vm.totalSteps - 1 {
                Button("Next") { vm.advance() }
                    .buttonStyle(.borderedProminent)
                    .disabled(!vm.canAdvance)
            } else {
                Button("Build My Plan") { onFinish() }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
            }
        }
    }
}

struct GeneratingView: View {
    let complete: Bool
    @State private var rotation = 0.0
    @State private var showCheck = false

    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                if !showCheck {
                    Image(systemName: "figure.run")
                        .font(.system(size: 60))
                        .foregroundStyle(.accent)
                        .rotationEffect(.degrees(rotation))
                        .onAppear {
                            withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                                rotation = 360
                            }
                        }
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.green)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(height: 80)

            VStack(spacing: 8) {
                Text(complete ? "Your plan is ready." : "Building your plan…")
                    .font(.title2.bold())
                Text(complete ? "Let's get running." : "Applying training science to your profile.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .onChange(of: complete) { _, isComplete in
            if isComplete {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                    showCheck = true
                }
            }
        }
    }
}
