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

    async function handleSourceClick(e, wrapper, url) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;

        // Stop Icon Grid or other plugin JS from stealing the click and navigating/animating
        e.preventDefault();
        e.stopPropagation();

        const transitionId = wrapper.dataset.transitionId;
        if (!transitionId) {
            window.location.href = url;
            return;
        }

        // MOBILE UX FIX: If this is an Icon Grid tile and we are on mobile, 
        // we might need to manually trigger the "active" state (scale up) 
        // before starting the transition.
        const isIconGridTile = !!wrapper.querySelector('.icon-grid-gradient');
        const isMobile = window.innerWidth <= 1024;

        if (isIconGridTile && isMobile) {
            const isAlreadyActive = wrapper.classList.contains('is-active');

            if (!isAlreadyActive) {
                // 1. Manually add active class to this tile
                wrapper.classList.add('is-active');

                // 2. Remove active class from siblings in the same grid
                const parentGrid = wrapper.closest('.wp-block-exzenter-icon-grid-unlimited');
                if (parentGrid) {
                    parentGrid.querySelectorAll('.icon-grid-cell-wrapper.is-active').forEach(sibling => {
                        if (sibling !== wrapper) sibling.classList.remove('is-active');
                    });
                }

                // 3. Wait for the CSS transition (scale up) to complete
                // Usually takes ~250-300ms, let's wait 300ms for safety
                await wait(300);
            }
        }

        activeTransitionId = transitionId;
        isBackNavigation = false;

        // Perform transition using the wrapper
        // Since we waited (if needed), the dimensions will reflect the active/scaled-up state
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

        // Check if this is an Icon Grid tile (has .icon-grid-gradient)
        const isIconGridTile = !!sourceEl.querySelector('.icon-grid-gradient');

        let clone, sourceRect, elementToHide;

        if (isIconGridTile) {
            // ICON GRID: Clone SVG and wrap in div (like regular blocks)
            const gradientSvg = sourceEl.querySelector('.icon-grid-gradient');
            const fullRect = gradientSvg.getBoundingClientRect();

            // Get the tight bounding box of the actual visual content
            const bbox = gradientSvg.getBBox();
            const viewBox = gradientSvg.viewBox.baseVal;

            // Calculate where the visual content actually is on screen
            const visualRect = {
                left: fullRect.left + (bbox.x / viewBox.width) * fullRect.width,
                top: fullRect.top + (bbox.y / viewBox.height) * fullRect.height,
                width: (bbox.width / viewBox.width) * fullRect.width,
                height: (bbox.height / viewBox.height) * fullRect.height
            };

            // Use the visual rect as our source
            sourceRect = visualRect;

            // Clone the SVG and crop its viewBox
            const svgClone = gradientSvg.cloneNode(true);
            svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            svgClone.setAttribute('preserveAspectRatio', 'none');
            svgClone.removeAttribute('width');
            svgClone.removeAttribute('height');
            svgClone.style.width = '100%';
            svgClone.style.height = '100%';
            svgClone.style.display = 'block';
            svgClone.style.maxWidth = 'none';
            svgClone.style.maxHeight = 'none';

            // Wrap in a div (like regular blocks) - this is what we animate
            clone = document.createElement('div');
            clone.classList.add('transition-clone');
            clone.style.margin = '0';
            clone.style.transform = 'none';
            clone.style.overflow = 'visible';
            clone.appendChild(svgClone);

            elementToHide = gradientSvg;
        } else {
            // REGULAR BLOCKS: Clone the entire wrapper (original behavior)
            clone = sourceEl.cloneNode(true);
            clone.classList.add('transition-clone');
            clone.style.margin = '0';
            clone.style.transform = 'none';
            clone.style.display = 'flex';
            clone.style.alignItems = 'center';
            clone.style.justifyContent = 'center';
            clone.style.overflow = 'hidden';

            // Ensure nested SVG/img fills the clone
            const nestedMedia = clone.querySelectorAll('svg, img');
            nestedMedia.forEach(el => {
                el.removeAttribute('width');
                el.removeAttribute('height');
                el.style.width = '100%';
                el.style.height = '100%';
                el.style.maxWidth = 'none';
                el.style.maxHeight = 'none';
                el.style.display = 'block';
            });

            // Force ALL intermediate wrappers to fill the clone
            clone.querySelectorAll('*').forEach(el => {
                el.style.maxWidth = 'none';
                el.style.maxHeight = 'none';
            });
            clone.querySelectorAll(':scope > *, :scope > * > *').forEach(el => {
                el.style.width = '100%';
                el.style.height = '100%';
            });

            sourceRect = sourceEl.getBoundingClientRect();
            elementToHide = sourceEl;
        }

        overlay.appendChild(clone);
        document.body.appendChild(overlay);

        // Style the clone for animation
        clone.style.pointerEvents = 'none';

        // 2. Position Clone
        setCloneStyles(clone, sourceRect);

        // 3. Hide Original
        elementToHide.style.opacity = '0';

        // 4. Animate to Explode
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        const blockScale = sourceEl.closest('[data-transition-scale-explode]')?.dataset.transitionScaleExplode;
        const scaleFactor = (blockScale && !isNaN(parseFloat(blockScale)) && parseFloat(blockScale) !== 0) ? parseFloat(blockScale) : config.scaleExplode;

        const explodeW = sourceRect.width * scaleFactor;
        const explodeH = sourceRect.height * scaleFactor;

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

                // Find Target in New DOM and hide the correct element
                const targetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);
                if (targetWrapper) {
                    const isTargetIconGrid = !!targetWrapper.querySelector('.icon-grid-gradient');
                    const targetElement = isTargetIconGrid
                        ? targetWrapper.querySelector('.icon-grid-gradient')
                        : targetWrapper;
                    if (targetElement) targetElement.style.opacity = '0';
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
            // Check if target is Icon Grid (same logic as source)
            const isTargetIconGrid = !!targetWrapper.querySelector('.icon-grid-gradient');

            let measureElement, targetRect;

            if (isTargetIconGrid) {
                // ICON GRID TARGET: Apply viewBox-aware measurement (viewBox starts at 0,0)
                const targetSvg = targetWrapper.querySelector('.icon-grid-gradient');
                const fullRect = targetSvg.getBoundingClientRect();
                const bbox = targetSvg.getBBox();
                const viewBox = targetSvg.viewBox.baseVal;

                targetRect = {
                    left: fullRect.left + ((bbox.x - viewBox.x) / viewBox.width) * fullRect.width,
                    top: fullRect.top + ((bbox.y - viewBox.y) / viewBox.height) * fullRect.height,
                    width: (bbox.width / viewBox.width) * fullRect.width,
                    height: (bbox.height / viewBox.height) * fullRect.height
                };
                measureElement = targetSvg;
            } else {
                // REGULAR BLOCKS: Calculate visual rect accounting for preserveAspectRatio
                measureElement = targetWrapper.querySelector('svg') ||
                    targetWrapper.querySelector('img') ||
                    targetWrapper;

                const rect = measureElement.getBoundingClientRect();

                if (measureElement.tagName === 'svg' && measureElement.viewBox?.baseVal?.width) {
                    const vb = measureElement.viewBox.baseVal;
                    const svgAspect = vb.width / vb.height;
                    const rectAspect = rect.width / rect.height;

                    let visualWidth, visualHeight, visualLeft, visualTop;

                    if (svgAspect > rectAspect) {
                        visualWidth = rect.width;
                        visualHeight = rect.width / svgAspect;
                        visualLeft = rect.left;
                        visualTop = rect.top + (rect.height - visualHeight) / 2;
                    } else {
                        visualHeight = rect.height;
                        visualWidth = rect.height * svgAspect;
                        visualTop = rect.top;
                        visualLeft = rect.left + (rect.width - visualWidth) / 2;
                    }

                    targetRect = {
                        left: visualLeft,
                        top: visualTop,
                        width: visualWidth,
                        height: visualHeight
                    };
                } else {
                    targetRect = rect;
                }
            }

            if (measureElement) {
                // Hide the WRAPPER (so nothing shows during animation)
                targetWrapper.style.opacity = '0';

                // For Icon Grid SOURCE: swap clone with a new clone from TARGET
                // This uses the target's SVG structure which animates correctly
                if (isIconGridTile && !isTargetIconGrid) {
                    // Get current explode position from existing clone
                    const currentLeft = clone.style.left;
                    const currentTop = clone.style.top;
                    const currentWidth = clone.style.width;
                    const currentHeight = clone.style.height;

                    // Remove old clone
                    clone.remove();

                    // Create new clone from target (like regular blocks)
                    clone = targetWrapper.cloneNode(true);
                    clone.classList.add('transition-clone');
                    clone.style.margin = '0';
                    clone.style.transform = 'none';
                    clone.style.display = 'flex';
                    clone.style.alignItems = 'center';
                    clone.style.justifyContent = 'center';
                    clone.style.overflow = 'hidden';
                    clone.style.opacity = '1'; // Override inherited opacity from hidden wrapper

                    // Ensure nested SVG/img fills the clone
                    clone.querySelectorAll('svg, img').forEach(el => {
                        el.removeAttribute('width');
                        el.removeAttribute('height');
                        el.style.width = '100%';
                        el.style.height = '100%';
                        el.style.maxWidth = 'none';
                        el.style.maxHeight = 'none';
                        el.style.display = 'block';
                    });
                    clone.querySelectorAll('*').forEach(el => {
                        el.style.maxWidth = 'none';
                        el.style.maxHeight = 'none';
                    });
                    clone.querySelectorAll(':scope > *, :scope > * > *').forEach(el => {
                        el.style.width = '100%';
                        el.style.height = '100%';
                    });

                    // Position at current explode location
                    clone.style.position = 'absolute';
                    clone.style.left = currentLeft;
                    clone.style.top = currentTop;
                    clone.style.width = currentWidth;
                    clone.style.height = currentHeight;

                    overlay.appendChild(clone);
                }

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

                // Show the WRAPPER again
                targetWrapper.style.opacity = '';
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

            // Handling Scrolling & Anchors
            const destinationUrl = new URL(url, window.location.origin);
            const hash = destinationUrl.hash;

            const forceScroll = () => {
                if (hash) {
                    const targetEl = document.querySelector(hash);
                    if (targetEl) {
                        // Scroll to the element with hash
                        targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });

                        // Fix for WordPress Admin Bar if it exists
                        const adminBar = document.getElementById('wpadminbar');
                        if (adminBar) {
                            window.scrollBy(0, -adminBar.offsetHeight);
                        }
                        return;
                    }
                }

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


    // --- Helpers ---

    /**
     * Find the best SVG/image element to animate within a wrapper.
     * For Icon Grid Unlimited: prefer .icon-grid-gradient (the filled icon)
     * For other blocks: fall back to first SVG or IMG
     * 
     * @param {HTMLElement} wrapper - The wrapper element to search within
     * @returns {HTMLElement|null}
     */
    function findAnimatableSvg(wrapper) {
        // First, check for Icon Grid Unlimited gradient SVG
        const gradientSvg = wrapper.querySelector('.icon-grid-gradient');
        if (gradientSvg) return gradientSvg;

        // Fallback: any SVG or image
        return wrapper.querySelector('svg') || wrapper.querySelector('img');
    }

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

    /**
     * Clone the logo for animation.
     * If a gradientSvg is provided (Icon Grid Unlimited), clone just that SVG.
     * Otherwise, fallback to cloning the entire sourceEl.
     * 
     * @param {HTMLElement} sourceEl - The wrapper element with transition attributes
     * @param {SVGElement|null} gradientSvg - The .icon-grid-gradient SVG (optional)
     * @returns {{ clone: HTMLElement, rect: DOMRect }}
     */
    function cloneLogo(sourceEl, gradientSvg = null) {
        // Determine what to clone: prefer the gradient SVG if available
        const elementToClone = gradientSvg || sourceEl.querySelector('svg') || sourceEl.querySelector('img') || sourceEl;
        const rect = elementToClone.getBoundingClientRect();

        const clone = elementToClone.cloneNode(true);
        clone.classList.add('transition-clone');
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.opacity = '1'; // Ensure visible (the original may have opacity:0 initially)

        // If cloning an SVG, ensure it scales properly
        if (clone.tagName.toLowerCase() === 'svg') {
            clone.removeAttribute('width');
            clone.removeAttribute('height');
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.maxWidth = 'none';
            clone.style.maxHeight = 'none';
            clone.style.display = 'block';
        }

        // Handle nested SVG/img if we cloned a wrapper
        const nestedMedia = clone.querySelectorAll('svg, img');
        nestedMedia.forEach(el => {
            el.removeAttribute('width');
            el.removeAttribute('height');
            el.style.width = '100%';
            el.style.height = '100%';
            el.style.maxWidth = 'none';
            el.style.maxHeight = 'none';
            el.style.display = 'block';
        });

        return { clone, rect };
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
