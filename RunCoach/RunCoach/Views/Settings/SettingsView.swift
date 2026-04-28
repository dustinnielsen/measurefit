import SwiftUI
import SwiftData

struct SettingsView: View {
    @Query private var profiles: [UserProfile]
    @Environment(\.modelContext) private var modelContext
    @State private var showEditProfile = false
    @State private var showRegenConfirm = false
    @State private var showDeleteConfirm = false
    @State private var showAbout = false

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        NavigationStack {
            Group {
                if let profile {
                    List {
                        profileSection(profile)
                        planSection(profile)
                        aboutSection
                        dangerSection(profile)
                    }
                    .listStyle(.insetGrouped)
                } else {
                    ContentUnavailableView(
                        "No Profile",
                        systemImage: "person.slash",
                        description: Text("Complete onboarding to get started.")
                    )
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showEditProfile) {
                if let profile { EditProfileView(profile: profile, onSave: { regeneratePlan(profile: profile) }) }
            }
            .sheet(isPresented: $showAbout) { AboutView() }
            .confirmationDialog("Regenerate your plan?", isPresented: $showRegenConfirm, titleVisibility: .visible) {
                Button("Regenerate", role: .destructive) {
                    if let profile { regeneratePlan(profile: profile) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will delete your current plan and all completion tracking. Your profile settings won't change.")
            }
            .confirmationDialog("Delete all data?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete Everything", role: .destructive) { deleteAll() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This permanently deletes your profile and training plan. You'll need to complete onboarding again.")
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private func profileSection(_ profile: UserProfile) -> some View {
        Section {
            SettingsRow(icon: "person.circle.fill", label: "Ability", value: profile.ability.label, color: .blue)
            SettingsRow(icon: "flag.fill", label: "Goal", value: "\(profile.goal.emoji) \(profile.goal.label)", color: .orange)
            SettingsRow(icon: "calendar", label: "Days / Week", value: "\(profile.runningDaysPerWeek) days", color: .green)
            SettingsRow(icon: "figure.run.circle.fill", label: "Weekly Mileage", value: String(format: "%.0f mi", profile.currentWeeklyMileage), color: .rcAccent)

            Button("Edit Profile") { showEditProfile = true }
                .foregroundStyle(.rcAccent)
        } header: {
            Text("Your Profile")
        }
    }

    @ViewBuilder
    private func planSection(_ profile: UserProfile) -> some View {
        Section {
            if let plan = profile.activePlan {
                SettingsRow(icon: "calendar.badge.clock", label: "Total Weeks", value: "\(plan.totalWeeks) weeks", color: .purple)
                SettingsRow(icon: "chart.line.uptrend.xyaxis", label: "Peak Mileage", value: String(format: "%.0f mi/wk", plan.peakWeeklyMileage), color: .rcAccent)
                SettingsRow(icon: "clock.fill", label: "Generated", value: plan.generatedAt.formatted(date: .abbreviated, time: .omitted), color: .secondary)
            }

            Button("Regenerate Plan") { showRegenConfirm = true }
                .foregroundStyle(.orange)
        } header: {
            Text("Training Plan")
        } footer: {
            Text("Regenerating creates a fresh plan based on your current profile. All completion history will be lost.")
        }
    }

    private var aboutSection: some View {
        Section("About") {
            Button {
                showAbout = true
            } label: {
                SettingsRow(icon: "info.circle.fill", label: "About RunCoach", value: "", color: .blue)
            }
            .foregroundStyle(.primary)

            SettingsRow(icon: "app.badge.fill", label: "Version", value: appVersion, color: .secondary)
        }
    }

    @ViewBuilder
    private func dangerSection(_ profile: UserProfile) -> some View {
        Section {
            Button("Delete All Data", role: .destructive) {
                showDeleteConfirm = true
            }
        } footer: {
            Text("Permanently deletes all data from this device. Cannot be undone.")
        }
    }

    // MARK: - Actions

    private func regeneratePlan(profile: UserProfile) {
        if let oldPlan = profile.activePlan {
            modelContext.delete(oldPlan)
        }
        profile.updatedAt = Date()
        insertPlan(for: profile, modelContext: modelContext)
    }

    private func deleteAll() {
        if let profile {
            modelContext.delete(profile)
        }
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}

// MARK: - Supporting views

struct SettingsRow: View {
    let icon: String
    let label: String
    let value: String
    var color: Color = .secondary

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: 7))

            Text(label)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
}

// MARK: - About view

private struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Image(systemName: "figure.run.circle.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.rcAccent)
                        Text("RunCoach")
                            .font(.largeTitle.bold())
                        Text("Personal running coach in your pocket")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 32)

                    VStack(alignment: .leading, spacing: 16) {
                        AboutSection(
                            icon: "brain.head.profile",
                            title: "How it works",
                            body: "RunCoach builds a personalized training plan based on your current fitness, goal, and available days. Plans follow the 80/20 rule (easy miles build the engine), a 10% weekly volume cap, and automatic deload weeks every 4th week."
                        )
                        AboutSection(
                            icon: "waveform.path.ecg",
                            title: "Adaptive training",
                            body: "After each run, log how you felt. The engine analyses pain, fatigue, energy, and completion rates to automatically adjust your upcoming sessions — backing off when needed, never forcing progression through warning signs."
                        )
                        AboutSection(
                            icon: "heart.fill",
                            title: "Safety first",
                            body: "Sharp pain always removes speed work. Moderate pain reduces intensity. High fatigue replaces quality sessions with easy runs. Your long-term health matters more than any single workout."
                        )
                    }
                    .padding()
                }
            }
            .background(Color.rcBase)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct AboutSection: View {
    let icon: String
    let title: String
    let body: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.headline)
            Text(body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .rcCard()
    }
}
