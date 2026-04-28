import SwiftUI
import SwiftData

@main
struct RunCoachApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: [UserProfile.self, TrainingPlan.self, WorkoutDay.self, RunFeedback.self])
    }
}

struct RootView: View {
    @Query private var profiles: [UserProfile]

    var body: some View {
        if profiles.isEmpty {
            OnboardingView()
        } else {
            MainTabView()
        }
    }
}
