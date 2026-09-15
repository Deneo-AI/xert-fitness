import Foundation

enum MemberLaunchGuideState: Equatable {
    case signIn
    case checking
    case retry
    case completeReadiness
    case bookFirstClass
    case enableReminder(bookingID: UUID)
    case activated(bookingID: UUID)

    var isCompact: Bool {
        if case .activated = self { return true }
        return false
    }
}

// A ready member with nothing booked used to be told to go and buy a session
// pack. Credits are retired, so that step could never be completed and never
// advanced: the guide parked every one of them on "choose your session access"
// permanently. What they actually need next is to book a class — the booking
// page is where paying comes up, and it knows the current options.
enum MemberLaunchGuideResolver {
    static func resolve(
        isSignedIn: Bool,
        onboardingLoaded: Bool,
        readinessComplete: Bool,
        bookingsLoaded: Bool,
        nextActiveBookingID: UUID?,
        nextConfirmedBookingID: UUID?,
        classRemindersEnabled: Bool,
        onboardingUnavailable: Bool,
        bookingsUnavailable: Bool
    ) -> MemberLaunchGuideState {
        guard isSignedIn else { return .signIn }
        guard !onboardingUnavailable else { return .retry }
        guard onboardingLoaded else { return .checking }
        guard readinessComplete else { return .completeReadiness }
        guard !bookingsUnavailable else { return .retry }
        guard bookingsLoaded else { return .checking }
        if let nextActiveBookingID {
            if !classRemindersEnabled, let nextConfirmedBookingID {
                return .enableReminder(bookingID: nextConfirmedBookingID)
            }
            return .activated(bookingID: nextActiveBookingID)
        }
        return .bookFirstClass
    }
}
