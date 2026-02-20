import admin from 'firebase-admin';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('Firebase');
let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): admin.app.App | null => {
  try {
    // Check if Firebase credentials are available
    const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!firebaseConfig) {
      logger.warn(
        'Firebase credentials not found. Push notifications will be disabled. ' +
          'Set FIREBASE_SERVICE_ACCOUNT environment variable to enable push notifications.'
      );
      return null;
    }

    // Parse the service account JSON
    const serviceAccount = JSON.parse(firebaseConfig);

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    logger.warn('Push notifications will be disabled');
    return null;
  }
};

export const getFirebaseApp = (): admin.app.App | null => {
  return firebaseApp;
};

export const getMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) {
    return null;
  }
  return admin.messaging(firebaseApp);
};

export default {
  initializeFirebase,
  getFirebaseApp,
  getMessaging,
};
