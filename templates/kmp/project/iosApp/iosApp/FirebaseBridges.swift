import Foundation
import FirebaseAnalytics
import FirebaseCore
import FirebaseCrashlytics
import FirebaseMessaging
import ComposeApp

/// Swift side of `core/firebase`: the only place the app touches the Firebase iOS SDK beyond `FirebaseApp.configure()`.
enum FirebaseBridgeRegistration {
    static func register() {
        FirebaseBridges.shared.register(
            pushToken: SwiftPushTokenBridge(),
            crashReporter: SwiftCrashReporterBridge(),
            analytics: SwiftAnalyticsBridge()
        )
    }
}

final class SwiftPushTokenBridge: PushTokenBridge {
    func currentToken(onToken: @escaping (String?) -> Void) {
        Messaging.messaging().token { token, _ in onToken(token) }
    }
}

final class SwiftCrashReporterBridge: CrashReporterBridge {
    func log(message: String) {
        Crashlytics.crashlytics().log(message)
    }

    func recordError(message: String) {
        Crashlytics.crashlytics().record(error: NSError(domain: "AcmeShop", code: 0, userInfo: [NSLocalizedDescriptionKey: message]))
    }

    func setUserId(userId: String?) {
        Crashlytics.crashlytics().setUserID(userId ?? "")
    }
}

final class SwiftAnalyticsBridge: AnalyticsBridge {
    func logEvent(name: String, params: [String: Any]) {
        Analytics.logEvent(name, parameters: params)
    }

    func setUserId(userId: String?) {
        Analytics.setUserID(userId)
    }

    func setUserProperty(key: String, value: String?) {
        Analytics.setUserProperty(value, forName: key)
    }

    func appInstanceId() -> String? {
        Analytics.appInstanceID()
    }
}
