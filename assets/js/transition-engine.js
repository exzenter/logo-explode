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

    // Default Config (fallback if wpLogoExplodeSettings is missing)
    const defaults = {
        durationExpand: 800,
        durationShrink: 800,
        scaleExplode: 100,
        layoutSettleDelay: 200,
        zIndex: 99999,
        forceScrollTop: true,
        globalBgColor: ''
    };

    const rawSettings = window.wpLogoExplodeSettings || {};
    const config = {
        durationExpand: parseInt(rawSettings.durationExpand) || defaults.durationExpand,
        durationShrink: parseInt(rawSettings.durationShrink) || defaults.durationShrink,
        scaleExplode: parseFloat(rawSettings.scaleExplode) || defaults.scaleExplode,
        layoutSettleDelay: parseInt(rawSettings.layoutSettleDelay) || defaults.layoutSettleDelay,
        zIndex: parseInt(rawSettings.zIndex) || defaults.zIndex,
        forceScrollTop: rawSettings.forceScrollTop !== undefined ? (rawSettings.forceScrollTop === '1' || rawSettings.forceScrollTop === true) : defaults.forceScrollTop,
        globalBgColor: rawSettings.globalBgColor || defaults.globalBgColor
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // Check URL state for active transition
        const urlParams = new URLSearchParams(window.location.search);
        activeTransitionId = urlParams.get('transition_id') || (history.state && history.state.transitionId);

        setupLinkInterception();

        if (history.scrollRestoration) {
            history.scrollRestoration = 'manual';
        }

        window.addEventListener('popstate', handlePopState);
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
    }

    function handleSourceClick(e, wrapper, url) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;

        // Stop Icon Grid or other plugin JS from stealing the click and navigating/animating
        e.preventDefault();
        e.stopPropagation();

        const transitionId = wrapper.dataset.transitionId;
        if (!transitionId) {
            window.location.href = url;
            return;
        }

        activeTransitionId = transitionId;
        isBackNavigation = false;

        // NEW: Prefer the wrapper itself as the source if it's a "block" source
        // This ensures backgrounds and labels come along for the ride.
        performTransition(url, wrapper, 'expand', transitionId);
    }

    function handlePopState(e) {
        // Since we are using pushState for transitions, the browser won't reload by default on Back/Forward.
        // We force a reload to ensure the correct page content is displayed and to reset the state.
        // This is the most robust way to handle the "Vector Overlay" effect limits without building a full router.
        window.location.reload();
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

        // EXTRA: If the source is a link/block with multiple things inside, 
        // we might want to preserve its internal layout.
        clone.style.display = 'flex';
        clone.style.alignItems = 'center';
        clone.style.justifyContent = 'center';
        clone.style.overflow = 'hidden';
        clone.style.pointerEvents = 'none'; // Overlay handles clicks

        // 2. Position Clone
        const startRect = sourceEl.getBoundingClientRect();
        setCloneStyles(clone, startRect);

        // 3. Hide Original
        // We hide the WRAPPER usually, or the SVG. To be safe, hide the SVG directly.
        sourceEl.style.opacity = '0';

        // 4. Animate to Explode
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        const blockScale = sourceEl.closest('[data-transition-scale-explode]')?.dataset.transitionScaleExplode;
        const scaleFactor = (blockScale && !isNaN(parseFloat(blockScale)) && parseFloat(blockScale) !== 0) ? parseFloat(blockScale) : config.scaleExplode;

        const explodeW = startRect.width * scaleFactor;
        const explodeH = startRect.height * scaleFactor;

        const explodeStyles = {
            width: `${explodeW}px`,
            height: `${explodeH}px`,
            left: `${viewportW / 2 - explodeW / 2}px`,
            top: `${viewportH / 2 - explodeH / 2}px`
        };

        const blockDurExpand = sourceEl.closest('[data-transition-duration-expand]')?.dataset.transitionDurationExpand;
        const durExpand = (blockDurExpand && !isNaN(parseInt(blockDurExpand)) && parseInt(blockDurExpand) !== 0) ? parseInt(blockDurExpand) : config.durationExpand;

        await animateTo(clone, explodeStyles, durExpand, 'cubic-bezier(0.2, 0.9, 0.2, 1)');

        // 5. Fetch New Page
        // Use View Transition API for content if available, else manual
        if (document.startViewTransition) {
            const transition = document.startViewTransition(async () => {
                await loadNewContent(url, transitionId);

                // Find Target in New DOM
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
        // Wait for the double-scroll reset and layout to fully settle
        await wait(config.layoutSettleDelay);
        await requestFrame();
        // Only works if we successfully loaded the new DOM and found the target
        const targetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);

        if (targetWrapper) {
            // Find SVG
            const targetSvg = targetWrapper.querySelector('svg') || targetWrapper.querySelector('img');

            if (targetSvg) {
                targetSvg.style.opacity = '0'; // Ensure hidden

                const targetRect = targetSvg.getBoundingClientRect();

                // Offsets
                const offsetX = targetWrapper.dataset.transitionOffsetX ? parseFloat(targetWrapper.dataset.transitionOffsetX) : 0;
                const offsetY = targetWrapper.dataset.transitionOffsetY ? parseFloat(targetWrapper.dataset.transitionOffsetY) : 0;

                const finalStyles = {
                    width: `${targetRect.width}px`,
                    height: `${targetRect.height}px`,
                    left: `${targetRect.left + offsetX}px`,
                    top: `${targetRect.top + offsetY}px`
                };

                const blockDurShrink = sourceEl.closest('[data-transition-duration-shrink]')?.dataset.transitionDurationShrink;
                const durShrink = (blockDurShrink && !isNaN(parseInt(blockDurShrink)) && parseInt(blockDurShrink) !== 0) ? parseInt(blockDurShrink) : config.durationShrink;

                await animateTo(clone, finalStyles, durShrink, 'cubic-bezier(0.2, 0, 0.2, 1)');
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
        try {
            const response = await fetch(url);
            const text = await response.text();
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(text, 'text/html');

            // Force scroll to top IMMEDIATELY before swap
            if (config.forceScrollTop) {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            }

            // Update History
            history.pushState({ transitionId: transitionId }, '', url);

            document.title = newDoc.title;
            // Update <html> class as well, as some plugins/themes use it for scoping
            document.documentElement.className = newDoc.documentElement.className;
            document.body.className = newDoc.body.className;

            // --- 1. Swap/Update Stylesheets (HEAD) ---
            const newHead = newDoc.head;
            const newLinks = Array.from(newHead.querySelectorAll('link[rel="stylesheet"], style'));
            const currentHead = document.head;

            newLinks.forEach(newLink => {
                if (newLink.tagName === 'LINK') {
                    if (!currentHead.querySelector(`link[href="${newLink.href}"]`)) {
                        const clone = newLink.cloneNode(true);
                        currentHead.appendChild(clone);
                    }
                } else if (newLink.tagName === 'STYLE') {
                    if (newLink.id) {
                        const existing = currentHead.querySelector(`#${newLink.id}`);
                        const clone = newLink.cloneNode(true);
                        if (existing) {
                            existing.replaceWith(clone);
                        } else {
                            currentHead.appendChild(clone);
                        }
                    } else {
                        currentHead.appendChild(newLink.cloneNode(true));
                    }
                }
            });

            // --- 1b. Sync Head Scripts ---
            const newHeadScripts = newDoc.head.querySelectorAll('script');
            newHeadScripts.forEach(oldScript => {
                const src = oldScript.getAttribute('src');
                if (src) {
                    // If it's a script that doesn't exist in current doc, load it
                    if (!document.querySelector(`script[src="${src}"]`)) {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        document.head.appendChild(newScript);
                    }
                }
            });

            // --- 2. Update Body Content ---
            // Preserve Overlay
            const overlay = document.querySelector('.transition-overlay');
            if (overlay) document.body.removeChild(overlay);

            document.body.innerHTML = newDoc.body.innerHTML;

            // Restore Overlay
            if (overlay) document.body.appendChild(overlay);

            // --- 3. Execute Scripts from New Body ---
            const newScripts = document.body.querySelectorAll('script');
            // Debug: Log all scripts found in the new body
            console.log('[Transition] Found', newScripts.length, 'scripts in new body.');

            newScripts.forEach(oldScript => {
                const newScript = document.createElement('script');

                // Copy attributes
                let isFluidScript = false;
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                    if (attr.name === 'src' && (attr.value.includes('gradient-fluid-block') || attr.value.includes('fluid-group'))) {
                        isFluidScript = true;
                        console.log('[Transition] Found Fluid Block script:', attr.value);
                    }
                });
                console.log('[Transition] Processing script:', oldScript.src || '(inline)');

                // Copy content
                if (oldScript.textContent) {
                    newScript.textContent = oldScript.textContent;
                }

                // Hook for Fluid Block
                if (isFluidScript) {
                    newScript.onload = () => {
                        console.log('[Transition] Fluid Block script loaded. Initializing...');
                        if (typeof window.initFluidGroupBlocks === 'function') {
                            window.initFluidGroupBlocks();
                        } else {
                            console.error('[Transition] Script loaded but initFluidGroupBlocks is undefined.');
                        }
                    };
                }

                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Force scroll again (wrapped in timeout to beat browser restoration)
            const forceScroll = () => {
                if (!config.forceScrollTop) return;
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
            };
            forceScroll();
            setTimeout(forceScroll, 50);
            setTimeout(forceScroll, 150);

            setupLinkInterception(); // Re-bind our links

            // Trigger events to help plugins re-initialize
            // Fallback: Check if it's already available (e.g. cached)
            setTimeout(() => {
                if (typeof window.initFluidGroupBlocks === 'function') {
                    console.log('[Transition] Fallback: calling initFluidGroupBlocks (in case onload missed or already loaded).');
                    window.initFluidGroupBlocks();
                }
            }, 100);

            window.dispatchEvent(new Event('resize'));
            document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
            window.dispatchEvent(new Event('load'));

            // jQuery Compatibility
            if (window.jQuery) {
                window.jQuery(document).trigger('ready');
            }

            // WordPress DOM Ready Compatibility
            if (window.wp && window.wp.domReady) {
                window.wp.domReady(() => { });
            }

        } catch (err) {
            console.error('Transition Failed:', err);
            window.location.href = url; // Fallback
        }
    }

    // --- Helpers --- (Same as before)
    function createOverlay() {
        // Find if the source element has a color override
        const sourceWrapper = document.querySelector(`[data-transition-id="${activeTransitionId}"][data-transition-role="source"]`);
        const bgColor = sourceWrapper?.dataset.transitionColor || config.globalBgColor;

        const el = document.createElement('div');
        el.className = 'transition-overlay';
        el.style.zIndex = config.zIndex;
        if (bgColor) {
            el.style.backgroundColor = bgColor;
            el.style.pointerEvents = 'auto'; // Block clicks if we have a background? Or not. User choice.
        }
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
        // Final safety check for duration
        const safeDuration = (isNaN(duration) || duration < 0) ? 0 : duration;

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
                duration: safeDuration,
                easing: easing,
                fill: 'forwards'
            });
            animation.onfinish = () => {
                Object.assign(element.style, styles);
                resolve();
            };
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function requestFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

})();
