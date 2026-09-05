# Maxi Personal AI

Maxi is a mobile-first personal AI interface with Gemini chat, local conversation history, memory, games, voice input, and a holographic HUD.

## Important security note

The frontend talks to the Maxi backend. Gemini API keys belong in the backend environment only. Never commit a real key to GitHub.

## Upload to GitHub

1. Create an empty GitHub repository named `maxi`.
2. Open PowerShell in this folder.
3. Run:

```powershell
git init
git add .
git commit -m "Prepare Maxi for mobile deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maxi.git
git push -u origin main
```

The repository includes a GitHub Pages workflow at `.github/workflows/pages.yml`. In GitHub, open **Settings > Pages**, choose **GitHub Actions**, and wait for the workflow to deploy the frontend.

## Deploy the backend with Render

1. Create a Render account and choose **New > Blueprint**.
2. Select this GitHub repository.
3. Render will detect `render.yaml` and create `maxi-backend`.
4. Add `GEMINI_API_KEY` when Render asks for the secret.
5. Copy the deployed HTTPS backend URL.
6. In Maxi, open **Settings** and set **Maxi backend URL** to that URL.

Do not use a GitHub Pages URL for the backend. GitHub Pages only hosts the static frontend.

## Android APK

Install Node.js and Android Studio first. From the project folder:

```powershell
npm install
npm install @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**. The APK can be uploaded to a GitHub Release.

For a signed release APK, use Android Studio's **Build > Generate Signed Bundle / APK** and keep the signing key private.

## iPhone

iPhone does not install APK files. Build the iOS target on macOS with Xcode:

```bash
npm install
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

Use Xcode to run on an iPhone or upload to TestFlight. An Apple Developer account is required for TestFlight distribution.

## Local backend development

Python must be installed. Then in PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
python .\backend\server.py
```

The local backend runs at `http://127.0.0.1:8787`. The browser app defaults to that URL.

## Current boundaries

PC control, remote screen viewing, Gemini Live audio, cloud authentication, and server-side persistent memory still need their production services. The current app keeps frontend memories and games locally while the backend provides the secure Gemini chat boundary.
