/* istanbul ignore file -- thin glue over firebase-admin; proven by a real push, not by unit tests. */
import type { App } from 'firebase-admin/app';
import type { FcmMessaging } from './fcm';

let appSequence = 0;

/** firebase-admin is loaded lazily, so a project that never sends push never pays for it. */
export const createFirebaseMessaging = (
  serviceAccount: object,
): { messaging: () => Promise<FcmMessaging>; close: () => Promise<void> } => {
  let app: App | undefined;
  let messaging: Promise<FcmMessaging> | undefined;
  return {
    messaging: () => {
      messaging ??= (async (): Promise<FcmMessaging> => {
        const { initializeApp, cert } = await import('firebase-admin/app');
        const { getMessaging } = await import('firebase-admin/messaging');
        appSequence += 1;
        app = initializeApp(
          { credential: cert(serviceAccount as never) },
          `__SDK_DIR__-fcm-${String(appSequence)}`,
        );
        return getMessaging(app);
      })();
      return messaging;
    },
    close: async () => {
      if (app !== undefined) {
        const { deleteApp } = await import('firebase-admin/app');
        await deleteApp(app);
      }
      app = undefined;
      messaging = undefined;
    },
  };
};
