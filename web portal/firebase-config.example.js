// Copy this file to firebase-config.js after creating a Firebase project.
// Then paste your project settings from Firebase Console > Project settings > Web app.

window.STUDENT_PORTAL_FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

// Optional runtime settings:
// - Set portalKey to the student roll number or login id so every device syncs the same record.
// - Set deviceMode to 'admin' only on the main/admin computer. Leave student devices on 'student'.
window.STUDENT_PORTAL_RUNTIME_CONFIG = {
  portalKey: 'student',
  deviceMode: 'student',
};
