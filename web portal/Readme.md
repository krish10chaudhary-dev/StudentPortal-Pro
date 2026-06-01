# Smart Student Web Portal

A responsive student dashboard built with HTML, CSS, JavaScript, Chart.js, Electron, and optional Firebase sync. The portal works as a desktop Electron app and as a browser/PWA-ready web app.

It includes dashboard analytics, marks, attendance, quizzes, tasks, portfolio, store/cart, profile editing, profile photo upload, local storage persistence, and an admin mode for controlling student records.

## Features

- Student dashboard with semester summary, attendance, marks, and activity cards
- Performance charts powered by Chart.js
- Attendance tracking with admin-only edit controls
- Task manager with filters and status updates
- Quiz center with score history
- Portfolio page with project cards and skill progress
- Store/cart interface for student supplies
- Profile page with name, roll number, school, college, email, phone, login ID, and photo upload
- Theme switcher with multiple visual themes
- Student mode for read-only academic data
- Admin mode for editing profile, marks, attendance, tasks, and portfolio data
- LocalStorage data layer with optional Firebase real-time sync
- Electron desktop wrapper
- PWA manifest and service worker caching

## Project Structure

```text
my-electron-app/
|-- main.js                         # Electron desktop window
|-- package.json                    # npm scripts and dependencies
|-- firebase.json                   # Firebase Hosting config
|-- firestore.rules                 # Firestore security rules
|-- storage.rules                   # Firebase Storage rules
|-- web portal/
|   |-- index.html                  # Main single-page app
|   |-- style.css                   # Responsive UI styles
|   |-- script.js                   # Routing, rendering, forms, admin mode
|   |-- data.js                     # Local data store and demo data
|   |-- firebase-service.js         # Optional Firebase bridge
|   |-- firebase-config.example.js  # Firebase config template
|   |-- pwa.js                      # PWA/service worker registration
|   |-- service-worker.js           # Offline cache worker
|   |-- manifest.webmanifest        # PWA metadata
|   `-- assets/icons/               # App icons
`-- lab-output/                     # Screenshots and lab/report artifacts
```

## Requirements

- Node.js
- npm
- Firebase CLI, only if deploying to Firebase

Install dependencies:

```bash
npm install
```

## Run The App

Start the Electron desktop app:

```bash
npm start
```

Run the web portal in a browser:

```bash
npm run serve
```

Then open:

```text
http://127.0.0.1:5173/index.html
```

## Login Details

Student login:

```text
Login ID: student
Password: student123
```

Admin login:

```text
Login ID: admin
Password: admin123
```

Student mode keeps academic/profile-management data read-only. Admin mode unlocks editing for marks, attendance, tasks, portfolio entries, profile details, and demo-data reset.

## Admin Control

There are two ways to use admin control:

1. Log in with the admin credentials above.
2. For Firebase/shared-device setup, set the runtime device mode to admin in `web portal/firebase-config.js`:

```js
window.STUDENT_PORTAL_RUNTIME_CONFIG = {
  portalKey: 'student',
  deviceMode: 'admin',
};
```

Use `deviceMode: 'admin'` only on your trusted/admin computer. Student devices should stay on:

```js
deviceMode: 'student'
```

## Profile Editing

The Profile page supports:

- Full name
- Roll number
- School name
- Email
- Phone number
- College
- Branch
- Current semester
- Login ID and password
- Profile photo upload/removal
- Theme selection

Profile photos are stored locally in the browser through LocalStorage as a data URL. The app currently limits uploaded images to 2 MB.

## Useful Scripts

```bash
npm start
```

Launches the Electron desktop app.

```bash
npm run serve
```

Serves the `web portal` folder on port `5173`.

```bash
npm run check
```

Runs JavaScript syntax checks for `web portal/data.js` and `web portal/script.js`.

## Firebase Setup

Firebase is optional. The portal works locally without it.

1. Install Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Log in:

```bash
firebase login
```

3. Copy the example config:

```powershell
Copy-Item "web portal\firebase-config.example.js" "web portal\firebase-config.js"
```

4. Paste your Firebase web app settings into `web portal/firebase-config.js`.

5. Set the runtime config:

```js
window.STUDENT_PORTAL_RUNTIME_CONFIG = {
  portalKey: 'student',
  deviceMode: 'student',
};
```

`portalKey` identifies the shared student record. Use the same `portalKey` on the student and admin devices if you want them to sync the same portal data.

6. Enable these services in Firebase Console:

- Authentication with anonymous sign-in
- Firestore Database

7. Deploy:

```bash
firebase deploy
```

## Data Storage

By default, the app stores data in browser LocalStorage. The data layer is in `web portal/data.js`.

When Firebase is configured, the app syncs the shared record through:

```text
portalUsers/{portalKey}
```

Admin login state and admin password are kept local so admin access is not synced to student devices.

## Security Note

This is a student/lab project style portal. The current Firebase setup is suitable for demos and controlled testing, but production use should add proper authentication, server-verified admin roles, stricter Firestore rules, and safer password handling.

## Build Notes

- The project uses plain frontend files instead of a framework.
- Electron loads `web portal/index.html` directly from `main.js`.
- Service worker caching is enabled for the browser/PWA version.
- If browser changes do not appear immediately, hard refresh or clear site data because the service worker may still have cached older assets.
