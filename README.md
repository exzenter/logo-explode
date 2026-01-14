# WP Logo Explode

**Seamless Vector Overlay page transitions for SVG logos.**

WP Logo Explode is a WordPress plugin that creates smooth, vector-based page transitions using your SVG logo. It bridges the gap between pages with a dynamic, high-performance animation.

## Features

- **Seamless Transitions:** smooth entry and exit animations using the View Transitions API (or fallback).
- **SVG Driven:** Uses your site's SVG logo for crisp scaling at any resolution.
- **Customizable:** Settings to control animation speed, easing, and style.
- **Lightweight:** Minimal impact on initial page load.

## Installation

1. Upload the `wp-logo-explode` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Configure settings via the WordPress Customizer or dedicated settings page (if applicable).

## Development

This plugin uses Node.js and `@wordpress/scripts` for building assets.

### Prerequisites

- Node.js
- npm

### Setup

1. Clone the repository.
2. Run `npm install` to install dependencies.

### Build Commands

- `npm start` - Starts the build for development with hot reloading.
- `npm run build` - Builds the code for production.
- `npm run packages-update` - Updates WordPress packages.

## Integration with Canvas Animations (Prompt for AI Agents)

If you are generating code with LLMs (like ChatGPT or Claude) for canvas animations on pages using this plugin, use the following **exact prompt** to ensure they coordinate correctly with the page transition.

### The Problem
When navigating via **WP Logo Explode**, the new page content is loaded and the `load` event fires **before** the "shrink" transition completes. Standard `DOMContentLoaded` scripts will start too early, interfering with the transition or having their canvas setup invalid.

### The Solution
The target page script must wait for the transition to finish. The plugin supports a global hook: `window.initializeOnPageCanvasAfterTransition`.

**Robustness:** The transition engine **polls** for this function for up to 2 seconds after the transition completes. This means even if your script loads slightly later than the transition (e.g., due to network delays), the hook will still fire correctly.

### Copy-Paste Prompt for AI
Give this instruction to the AI writing your canvas code:

> **Integration Request:**
> Please refactor the initialization logic of the canvas animation to support the "WP Logo Explode" transition engine.
>
> **CRITICAL REQUIREMENT:**
> You must expose your initialization function to the global `window` scope so the transition engine can trigger it at the exact right moment.
>
> Please allow the code to run in two modes:
> 1.  **Transition Mode:** The transition engine calls `window.initializeOnPageCanvasAfterTransition()`.
> 2.  **Standard Mode:** The code runs on `window.onload` (only if no transition is active).
>
> **REQUIRED CODE STRUCTURE:**
> Please structure your code exactly like this:
>
> ```javascript
> (function() {
>     // 1. Define your init function
>     function startMyCanvasAnimation() {
>         // Prevent double-init
>         if (window.hasMyCanvasAnimationStarted) return;
>         window.hasMyCanvasAnimationStarted = true;
>
>         console.log('Starting Canvas Animation...');
>         // ... [YOUR CANVAS SETUP CODE HERE] ...
>     }
>
>     // 2. EXPOSE GLOBALLY (Crucial!)
>     window.initializeOnPageCanvasAfterTransition = startMyCanvasAnimation;
>
>     // 3. Handle Normal Page Loads (Fallback)
>     window.addEventListener('load', () => {
>         // If NO transition overlay is present, start immediately.
>         // If an overlay IS present, do nothing; the engine will call the hook above.
>         if (!document.querySelector('.transition-overlay')) {
>             startMyCanvasAnimation();
>         }
>     });
> })();
> ```

## Robustness & Error Handling

The transition engine includes multiple safeguards to prevent the logo from getting stuck in the "explode" state:

### Failsafe Mechanisms

| Mechanism | Description |
|-----------|-------------|
| **Global Timeout** | If any transition takes longer than 15 seconds, it is automatically aborted and the page navigates normally. |
| **Tab Visibility Handler** | When the user switches tabs during a transition, it is immediately aborted to prevent animation hangs (browsers throttle animations in background tabs). |
| **View Transition API Timeout** | The View Transition API is given a maximum of 5 seconds to complete; otherwise, the transition proceeds manually. |
| **Animation Timeout Fallback** | Every animation has a fallback timeout (duration + 500ms) in case the `onfinish` event never fires. |
| **Missing Target Recovery** | If the target element is not found on the new page, the clone fades out gracefully and the overlay is cleaned up. |
| **Fetch Error Recovery** | If fetching the new page fails, the overlay is removed and the browser navigates normally. |

### Emergency Cleanup

The engine exposes an internal `emergencyCleanup()` function that:
- Removes the active transition overlay
- Cleans up any orphaned `.transition-overlay` elements
- Resets all transition state flags

This is automatically called in error scenarios and when the tab becomes hidden.

### Console Logging

All transition events are logged with the `[WP Logo Explode]` prefix for easy debugging:
- Transition start/complete events
- Hook polling status
- Warnings for missing targets
- Errors with detailed context

---

## Behavior When JavaScript Is Disabled

If JavaScript is disabled in the browser, the plugin behaves as follows:

| Component | Behavior |
|-----------|----------|
| **Links with `data-transition-link`** | **Do not work** – there is no native `href` on the wrapper element |
| **Links with nested `<a>` tags** | **Work normally** – the browser follows the native link |
| **Transition Overlay & Animation** | **Never appear** – no JavaScript means no overlay |
| **Navigation** | Depends on HTML structure – only real `<a>` links function |

### Recommended Fallback Pattern

To ensure your links work without JavaScript, use one of these patterns:

**Option 1: Use `<a>` as the wrapper (Progressive Enhancement)**
```html
<a href="/target-page" 
   data-transition-role="source" 
   data-transition-id="my-logo" 
   data-transition-link="/target-page">
    <img src="logo.svg" alt="Logo">
</a>
```

**Option 2: Nested link inside the wrapper**
```html
<div data-transition-role="source" 
     data-transition-id="my-logo">
    <a href="/target-page">
        <img src="logo.svg" alt="Logo">
    </a>
</div>
```
> [!NOTE]
> With Option 2, the transition engine will intercept the nested `<a>` click and perform the animated transition when JS is enabled.

**Option 3: Noscript fallback**
```html
<div data-transition-role="source" 
     data-transition-id="my-logo" 
     data-transition-link="/target-page">
    <img src="logo.svg" alt="Logo">
</div>
<noscript>
    <a href="/target-page">Navigate to page</a>
</noscript>
```

---

## Structure

- `src/` - Source files for JavaScript and block assets.
- `assets/` - Static assets like CSS and additional JS.
- `includes/` - PHP class files and server-side logic.
- `build/` - Compiled assets (generated by `npm run build`).

## License

GPL-2.0-or-later

