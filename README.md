# SkillSwap — Learn Together, Grow Together

A student-to-student skill-sharing website built with HTML, CSS, JavaScript (ES modules) and Firebase Authentication + Cloud Firestore.

## Features

- Email/password registration and login
- Student profiles: college, department, year, bio
- Skills a student can teach and skills they want to learn
- Explore and search student profiles by skill
- Send, accept, reject and cancel exchange requests
- Dashboard and accepted connections/contact details
- Responsive layout for desktop and mobile

## 1. Requirements

- Visual Studio Code
- Google Chrome (or another modern browser)
- Internet connection
- A free Firebase account: https://console.firebase.google.com/
- VS Code extension: **Live Server** (by Ritwick Dey), or another local HTTP server

> Do not open `index.html` directly using `file://`. Firebase ES modules should be served over HTTP/HTTPS.

## 2. Create and configure Firebase

1. Open https://console.firebase.google.com/ and create a project named `SkillSwap` (or any name).
2. In Project Overview, click **Add app** and choose the Web (`</>`) app.
3. Register the app. Firebase will show a config object.
4. Open `firebase-config.js` and replace every `YOUR_...` placeholder with the matching value from your Firebase web-app config.
5. In Firebase Console → **Authentication** → **Get started** → **Sign-in method**, enable **Email/Password**.
6. In Firebase Console → **Firestore Database** → **Create database**. For initial setup, choose production mode.
7. Open Firestore → **Rules**, replace the rules with the complete contents of `firestore.rules`, and click **Publish**.

### Firebase configuration note

The web config/API key identifies your Firebase project; it is not a service-account secret. Never put service-account JSON, Admin SDK credentials, or private keys in browser JavaScript. Restrict your API key in Google Cloud when appropriate.

## 3. Open in VS Code

1. Extract the ZIP file.
2. In VS Code choose **File → Open Folder** and select the extracted `skillswap` folder.
3. Install the **Live Server** extension.
4. Right-click `index.html` → **Open with Live Server**.
5. The site should open in your browser.

## 4. Test the multi-user flow

Use two separate browser profiles or one normal window and one Incognito window:

1. Register Student A with an email you control.
2. Complete the profile: add skills to teach and skills to learn.
3. In the other browser profile, register Student B with a different email.
4. Complete Student B's profile.
5. Open **Explore students** and send an exchange request.
6. Log in as the receiving student and open **Requests → Received**.
7. Accept the request.
8. Open **Your connections** to see the accepted partner's contact email, if they added one.

Use email addresses you control for testing. Do not publish personal phone numbers or private contact details.

## 5. Project structure

```text
skillswap/
├── index.html
├── styles.css
├── app.js
├── firebase-config.js
├── firestore.rules
└── README.md
```

## 6. Important notes / next improvements

- This version uses Firebase Authentication and Firestore, so accounts and profiles are shared across devices.
- The app intentionally shows a preferred contact email only for accepted partners. A user's login email is not exposed as their public contact email.
- Firestore may ask you to create a composite index for a query. If Firebase shows a link in the browser console, open it and create the suggested index.
- This starter version provides accepted-partner contact details, not live in-app chat. A secure real-time chat can be added next using a `conversations` and `messages` collection with rules that verify both participants.
- For a public deployment, add Firebase App Check, stricter field validation, abuse/report controls, and a privacy policy. Review and test security rules before launch.
- Never deploy with Firestore rules set to allow all reads/writes.

## Troubleshooting

**Firebase: Error (auth/unauthorized-domain)**  
Firebase Console → Authentication → Settings → Authorized domains. Add `localhost` if it is missing. If using a hosted domain, add that domain too.

**Missing or insufficient permissions**  
Make sure you published `firestore.rules` and that Authentication is enabled. Sign in before opening dashboard/profile/requests.

**Could not load students**  
Confirm Firestore Database was created and the rules were published. Check the browser developer console for the exact Firebase error.

**The page is blank / module import error**  
Run through Live Server or another local HTTP server. Do not use `file://`.
