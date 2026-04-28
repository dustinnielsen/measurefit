import SwiftUI
import SwiftData

struct ProfileView: View {
    @Query private var profiles: [UserProfile]
    @Environment(\.modelContext) private var modelContext
    @State private var showRegenConfirm = false
    @State private var showRegenSheet = false

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        NavigationStack {
            Group {
                if let profile {
                    List {
                        Section("Fitness") {
                            ProfileRow(label: "Age", value: "\(profile.age)")
                            ProfileRow(label: "Ability", value: profile.ability.label)
                            ProfileRow(label: "Weekly Mileage", value: String(format: "%.0f mi/week", profile.currentWeeklyMileage))
                            ProfileRow(label: "Longest Run", value: String(format: "%.1f mi", profile.longestRecentRun))
                        }

                        Section("Goal") {
                            ProfileRow(label: "Goal", value: "\(profile.goal.emoji) \(profile.goal.label)")
                            if let date = profile.goalDate {
                                ProfileRow(label: "Goal Date", value: date.formatted(date: .abbreviated, time: .omitted))
                            }
                        }

                        Section("Schedule") {
                            ProfileRow(label: "Run Days", value: "\(profile.runningDaysPerWeek) days/week")
                            ProfileRow(label: "Long Run Day", value: weekdayName(profile.preferredLongRunDay))
                            ProfileRow(label: "Strength Days", value: "\(profile.strengthDaysPerWeek) days/week")
                        }

                        Section("Training") {
                            ProfileRow(label: "Style", value: profile.trainingStyle.label)
                            if !profile.injuries.isEmpty {
                                ProfileRow(label: "Injury History", value: profile.injuries.map(\.label).joined(separator: ", "))
                            }
                        }

                        if let plan = profile.activePlan {
                            Section("Plan") {
                                ProfileRow(label: "Generated", value: plan.generatedAt.formatted(date: .abbreviated, time: .omitted))
                                ProfileRow(label: "Total Weeks", value: "\(plan.totalWeeks) weeks")
                                ProfileRow(label: "Peak Mileage", value: String(format: "%.0f mi/week", plan.peakWeeklyMileage))
                            }
                        }

                        Section {
                            Button("Regenerate Plan") {
                                showRegenConfirm = true
                            }
                            .foregroundStyle(.orange)
                        } footer: {
                            Text("Regenerating will delete your current plan and all completion tracking. Your profile settings won't change.")
                        }

                        Section {
                            Button("Edit Profile", role: .none) {
                                showRegenSheet = true
                            }
                        }
                    }
                    .confirmationDialog(
                        "Regenerate your plan?",
                        isPresented: $showRegenConfirm,
                        titleVisibility: .visible
                    ) {
                        Button("Regenerate", role: .destructive) {
                            regeneratePlan(profile: profile)
                        }
                        Button("Cancel", role: .cancel) {}
                    } message: {
                        Text("This will delete your current plan and all completion tracking. Your profile won't change.")
                    }
                } else {
                    ContentUnavailableView("No Profile", systemImage: "person.slash", description: Text("Complete onboarding to get started."))
                }
            }
            .navigationTitle("Profile")
            .sheet(isPresented: $showRegenSheet) {
                if let profile { EditProfileView(profile: profile, onSave: { regeneratePlan(profile: profile) }) }
            }
        }
    }

    private func regeneratePlan(profile: UserProfile) {
        if let oldPlan = profile.activePlan {
            modelContext.delete(oldPlan)
        }
        profile.updatedAt = Date()
        insertPlan(for: profile, modelContext: modelContext)
    }

    private func weekdayName(_ day: Int) -> String {
        let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return names[safe: day] ?? "Unknown"
    }
}

struct ProfileRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
    }
}

struct EditProfileView: View {
    @Bindable var profile: UserProfile
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Fitness") {
                    Stepper("Age: \(profile.age)", value: $profile.age, in: 13...80)
                    Picker("Ability", selection: $profile.abilityRaw) {
                        ForEach(RunningAbility.allCases, id: \.rawValue) { Text($0.label).tag($0.rawValue) }
                    }
                    LabeledContent("Weekly Mileage") {
                        TextField("Miles", value: $profile.currentWeeklyMileage, format: .number)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }

                Section("Goal") {
                    Picker("Goal", selection: $profile.goalRaw) {
                        ForEach(RunningGoal.allCases, id: \.rawValue) { Text($0.label).tag($0.rawValue) }
                    }
                }

                Section("Training Style") {
                    Picker("Style", selection: $profile.trainingStyleRaw) {
                        ForEach(TrainingStyle.allCases, id: \.rawValue) { Text($0.label).tag($0.rawValue) }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save & Rebuild") {
                        profile.updatedAt = Date()
                        onSave()
                        dismiss()
                    }
                }
            }
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
