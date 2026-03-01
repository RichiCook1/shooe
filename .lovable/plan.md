

# Make Sherpa an Installable PWA

Turn Sherpa into a Progressive Web App so users can add it to their phone's home screen and use it like a native app.

## What You'll Get
- An "Add to Home Screen" prompt on mobile browsers
- Full-screen app experience (no browser toolbar)
- App icon on the home screen with Sherpa branding
- Faster load times on repeat visits via caching

## Steps

### 1. Create a Web App Manifest (`public/manifest.json`)
This file tells the browser how to display the app when installed -- name, colors, icons, and display mode (standalone = no browser chrome).

### 2. Add PWA Icons
Generate a set of app icons (192x192 and 512x512) using the existing favicon as a base. These will be placed in `/public/` and referenced in the manifest.

### 3. Create a Service Worker (`public/sw.js`)
A lightweight service worker that caches the app shell for offline support and faster loading. It will use a cache-first strategy for static assets.

### 4. Update `index.html`
- Link to the manifest file
- Add `<meta name="theme-color">` for the status bar color
- Add Apple-specific meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`) for iOS support
- Register the service worker via an inline script

### 5. Add Apple Touch Icon
iOS Safari doesn't use the manifest icons, so a separate `apple-touch-icon.png` (180x180) is needed.

## Technical Details

**Manifest configuration:**
- `display: "standalone"` -- removes browser UI
- `start_url: "/"` -- opens to home page
- `theme_color` and `background_color` matched to Sherpa's brand colors

**Service worker strategy:**
- Cache app shell (HTML, CSS, JS) on install
- Serve cached content when offline
- Update cache when new versions are available

**iOS-specific tags:**
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## How Users Install It
- **iOS Safari**: Tap Share button, then "Add to Home Screen"
- **Android Chrome**: A banner will auto-appear, or tap menu then "Add to Home Screen"

