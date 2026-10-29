import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import ComposeApp

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let firebaseReady = FirebaseSetup.configureIfValid()
        if firebaseReady {
            FirebaseBridgeRegistration.register()
        }
        MainViewControllerKt.doInitKoin()

        if firebaseReady {
            Messaging.messaging().delegate = self
        }
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
        application.registerForRemoteNotifications()

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        guard FirebaseApp.app() != nil else { return }
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        MainViewControllerKt.saveFcmToken(token: token)
        PushTokenRelay.shared.publish(token: token)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // PRD §10.2: in the foreground the shared shell shows an in-app banner instead of the system one.
        let content = notification.request.content
        MainViewControllerKt.pushReceivedInForeground(userInfo: content.userInfo, title: content.title, body: content.body)
        completionHandler([])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let content = response.notification.request.content
        MainViewControllerKt.pushTapped(userInfo: content.userInfo, title: content.title, body: content.body)
        completionHandler()
    }
}
