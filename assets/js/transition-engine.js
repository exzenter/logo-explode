/**
 * WP Logo Explode - Vector Overlay Engine
 * Modified to work with WordPress data attributes:
 * - data-transition-id="XYZ"
 * - data-transition-role="source|target"
 * - data-transition-link="URL"
 */

(function () {
    'use strict';

    // State
    let activeTransitionId = null;
    let isBackNavigation = false;

    // Animation Config
    const DURATION_EXPAND = 800;
    const DURATION_SHRINK = 800;
    const SCALE_EXPLODE = 100;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // Check URL state for active transition
        const urlParams = new URLSearchParams(window.location.search);
        activeTransitionId = urlParams.get('transition_id') || (history.state && history.state.transitionId);

        // Check if we just arrived via a transition (History state)
        // If so, we might need to handle the "landing" animation if we didn't use fetch swap?
        // In this SPA-like hybrid, we expect to be fully loaded.

        setupLinkInterception();

        if (history.scrollRestoration) {
            history.scrollRestoration = 'manual';
        }
    }

    function setupLinkInterception() {
        // Find SOURCE blocks
        // In WP, the attributes might be on the wrapper. We look for [data-transition-role="source"]
        const sources = document.querySelectorAll('[data-transition-role="source"]');

        sources.forEach(wrapper => {
            // The wrapper might NOT be a link itself. It might contain a link, or we make it clickable.
            // Ideally, the user sets the link in our sidebar, so we handle the click.
            const url = wrapper.dataset.transitionLink;
            if (url) {
                wrapper.style.cursor = 'pointer';
                wrapper.addEventListener('click', (e) => handleSourceClick(e, wrapper, url));
            } else {
                // Fallback: Check if it wraps an <a> tag
                const link = wrapper.querySelector('a');
                if (link) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        handleSourceClick(e, wrapper, link.href);
                    });
                }
            }
        });

        // Handle Back Button?
        // Standard back button support needs History API handling.
        window.addEventListener('popstate', handlePopState);
    }

    function handleSourceClick(e, wrapper, url) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        // prevent default if it was a link
        e.preventDefault();

        const transitionId = wrapper.dataset.transitionId;
        if (!transitionId) {
            window.location.href = url;
            return;
        }

        activeTransitionId = transitionId;
        isBackNavigation = false;

        // Find the SVG inside the wrapper
        const svg = wrapper.querySelector('svg') || wrapper.querySelector('img');
        performTransition(url, svg, 'expand', transitionId);
    }

    function handlePopState(e) {
        // If we are going back, check internal state
        if (e.state && e.state.transitionId) {
            isBackNavigation = true;
            activeTransitionId = e.state.transitionId;

            // Current page is the "Target" page (Hero). We need to shrink back to "Source".
            // Actually, 'shrink' logic assumes we are at Hero and going to Grid.
            // Yes. 

            // Wait, 'popstate' fires when we ARE at the new URL. 
            // So if we went Back -> We are now at Home URL.
            // But we haven't rendered Home yet? No, browser reloaded or restored BF Cache.
            // If BF Cache used, page is ready.

            // For this specific 'Vector Overlay' effect to work across full page loads,
            // we usually need to intercept the creation of the old page?
            // Simplest MVP: Just reload the page if it's a popstate, 
            // or rely on the standard "fetch new page" logic if we intercepted clicks.
            // Standard browser Back button will reload page in MPA. 
            window.location.reload();
        }
    }

    async function performTransition(url, sourceEl, direction, transitionId) {
        if (!sourceEl) {
            window.location.href = url;
            return;
        }

        // 1. Setup Overlay
        const overlay = createOverlay();
        const clone = cloneLogo(sourceEl);
        overlay.appendChild(clone);
        document.body.appendChild(overlay);

        // 2. Position Clone
        const startRect = sourceEl.getBoundingClientRect();
        setCloneStyles(clone, startRect);

        // 3. Hide Original
        // We hide the WRAPPER usually, or the SVG. To be safe, hide the SVG directly.
        sourceEl.style.opacity = '0';

        // 4. Animate to Explode
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const explodeW = startRect.width * SCALE_EXPLODE;
        const explodeH = startRect.height * SCALE_EXPLODE;

        const explodeStyles = {
            width: `${explodeW}px`,
            height: `${explodeH}px`,
            left: `${viewportW / 2 - explodeW / 2}px`,
            top: `${viewportH / 2 - explodeH / 2}px`
        };

        await animateTo(clone, explodeStyles, DURATION_EXPAND, 'cubic-bezier(0.2, 0.9, 0.2, 1)');

        // 5. Fetch New Page
        // Use View Transition API for content if available, else manual
        if (document.startViewTransition) {
            const transition = document.startViewTransition(async () => {
                await loadNewContent(url, transitionId);

                // Find Target in New DOM
                // Look for [data-transition-id="ID"][data-transition-role="target"]
                const targetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);

                if (targetWrapper) {
                    const targetSvg = targetWrapper.querySelector('svg') || targetWrapper.querySelector('img');
                    if (targetSvg) targetSvg.style.opacity = '0';
                }
            });
            await transition.ready;
        } else {
            await loadNewContent(url, transitionId);
        }

        // 6. Animate Clone to Target
        // Only works if we successfully loaded the new DOM and found the target
        const targetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);

        if (targetWrapper) {
            // Find SVG
            const targetSvg = targetWrapper.querySelector('svg') || targetWrapper.querySelector('img');

            if (targetSvg) {
                targetSvg.style.opacity = '0'; // Ensure hidden

                const targetRect = targetSvg.getBoundingClientRect();
                const finalStyles = {
                    width: `${targetRect.width}px`,
                    height: `${targetRect.height}px`,
                    left: `${targetRect.left}px`,
                    top: `${targetRect.top}px`
                };

                await animateTo(clone, finalStyles, DURATION_SHRINK, 'cubic-bezier(0.2, 0, 0.2, 1)');
                targetSvg.style.opacity = '';
            }
        } else {
            // If no target found, just fade out overlay?
            console.warn('Target element not found for transition:', transitionId);
            clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => { };
        }

        overlay.remove();
    }

    async function loadNewContent(url, transitionId) {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(text, 'text/html');

        // Update History
        history.pushState({ transitionId: transitionId }, '', url);

        document.title = newDoc.title;
        document.body.className = newDoc.body.className;

        // Preserve Overlay
        const overlay = document.querySelector('.transition-overlay');
        if (overlay) document.body.removeChild(overlay);

        document.body.innerHTML = newDoc.body.innerHTML;

        // Restore Overlay
        if (overlay) document.body.appendChild(overlay);

        window.scrollTo(0, 0);
        setupLinkInterception(); // Re-bind
    }

    // --- Helpers --- (Same as before)
    function createOverlay() {
        const el = document.createElement('div');
        el.className = 'transition-overlay';
        return el;
    }

    function cloneLogo(sourceEl) {
        const clone = sourceEl.cloneNode(true);
        clone.classList.add('transition-clone');
        clone.style.margin = '0';
        clone.style.transform = 'none';

        // Copy computed styles roughly to ensure consistent look
        const comp = getComputedStyle(sourceEl);
        clone.style.fill = comp.fill;

        return clone;
    }

    function setCloneStyles(clone, rect) {
        clone.style.position = 'absolute';
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
    }

    function animateTo(element, styles, duration, easing) {
        return new Promise(resolve => {
            const animation = element.animate([
                {
                    width: element.style.width,
                    height: element.style.height,
                    left: element.style.left,
                    top: element.style.top
                },
                styles
            ], {
                duration: duration,
                easing: easing,
                fill: 'forwards'
            });
            animation.onfinish = () => {
                Object.assign(element.style, styles);
                resolve();
            };
        });
    }

})();
