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
    if (window.wpLogoExplodeInitialized) {
        console.log('[WP Logo Explode] Engine already initialized. Skipping re-init.');
        return;
    }
    window.wpLogoExplodeInitialized = true;

    let activeTransitionId = null;
    let isBackNavigation = false;
    let activeTransitionOverlay = null;
    let transitionAborted = false;
    let transitionInProgress = false; // FIX: Lock to prevent overlapping transitions

    // Timeout for failsafe cleanup (if transition hangs)
    const TRANSITION_TIMEOUT = 10000; // 10 seconds max

    // Default Config (fallback if wpLogoExplodeSettings is missing)
    const defaults = {
        durationExpand: 800,
        durationShrink: 800,
        scaleExplode: 100,
        layoutSettleDelay: 200,
        zIndex: 99999,
        forceScrollTop: true,
        globalBgColor: '',
        instantLoad: false,
        gpuAnimation: false,
        disableTransitions: false
    };

    const rawSettings = window.wpLogoExplodeSettings || {};
    const config = {
        durationExpand: parseInt(rawSettings.durationExpand) || defaults.durationExpand,
        durationShrink: parseInt(rawSettings.durationShrink) || defaults.durationShrink,
        scaleExplode: parseFloat(rawSettings.scaleExplode) || defaults.scaleExplode,
        layoutSettleDelay: parseInt(rawSettings.layoutSettleDelay) || defaults.layoutSettleDelay,
        zIndex: parseInt(rawSettings.zIndex) || defaults.zIndex,
        forceScrollTop: rawSettings.forceScrollTop !== undefined ? (rawSettings.forceScrollTop === '1' || rawSettings.forceScrollTop === true) : defaults.forceScrollTop,
        globalBgColor: rawSettings.globalBgColor || defaults.globalBgColor,
        instantLoad: rawSettings.instantLoad === '1' || rawSettings.instantLoad === true,
        gpuAnimation: rawSettings.gpuAnimation === '1' || rawSettings.gpuAnimation === true,
        disableTransitions: rawSettings.disableTransitions === '1' || rawSettings.disableTransitions === true
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // If transitions are disabled, skip all initialization
        if (config.disableTransitions) {
            console.log('[WP Logo Explode] Transitions are disabled. Links will function normally.');
            return;
        }

        // Check URL state for active transition
        const urlParams = new URLSearchParams(window.location.search);
        activeTransitionId = urlParams.get('transition_id') || (history.state && history.state.transitionId);

        setupLinkInterception();

        if (history.scrollRestoration) {
            history.scrollRestoration = 'manual';
        }

        window.addEventListener('popstate', handlePopState);

        // FIX: Handle tab visibility changes during transition
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    /**
     * FIX: Abort transition and cleanup when user switches tabs.
     * Animations are paused/throttled in background tabs which can cause hangs.
     */
    function handleVisibilityChange() {
        if (document.hidden && activeTransitionOverlay) {
            console.warn('[WP Logo Explode] Tab became hidden during transition. Aborting...');
            transitionAborted = true;
            emergencyCleanup();
        }
    }

    /**
     * FIX: Emergency cleanup function to recover from any stuck state.
     * Removes overlay and resets all transition state.
     */
    function emergencyCleanup() {
        if (activeTransitionOverlay) {
            activeTransitionOverlay.remove();
            activeTransitionOverlay = null;
        }
        // Also try to find any orphaned overlays
        document.querySelectorAll('.transition-overlay').forEach(el => el.remove());

        // Reset state
        transitionAborted = false;
        transitionInProgress = false; // FIX: Release lock on cleanup
    }

    function setupLinkInterception() {
        // Find SOURCE blocks
        // In WP, the attributes might be on the wrapper. We look for [data-transition-role="source"]
        const sources = document.querySelectorAll('[data-transition-role="source"]');

        sources.forEach(wrapper => {
            const url = wrapper.dataset.transitionLink;
            if (!url) return;

            wrapper.style.cursor = 'pointer';

            // Find the overlay link (injected by PHP for proper link semantics)
            const overlayLink = wrapper.querySelector('.wp-logo-explode-overlay-link');

            if (overlayLink) {
                // We have an overlay link - intercept its clicks for the transition
                overlayLink.addEventListener('click', (e) => {
                    // Only intercept normal left-clicks without modifiers
                    // Let browser handle: Ctrl+Click, Cmd+Click, Shift+Click, Middle-Click
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) {
                        return; // Let browser handle (new tab, etc.)
                    }

                    // Intercept for transition animation
                    e.preventDefault();
                    handleSourceClick(e, wrapper, url);
                });

                // For middle-click and other buttons, don't prevent default
                // The browser will open the link in a new tab naturally
                overlayLink.addEventListener('auxclick', (e) => {
                    // Do nothing - let browser handle middle-click naturally
                });
            } else {
                // Fallback: No overlay link found (older blocks or edge case)
                // Handle clicks on the wrapper itself
                wrapper.addEventListener('click', (e) => handleSourceClick(e, wrapper, url));
                wrapper.addEventListener('auxclick', (e) => handleSourceClick(e, wrapper, url));
            }
        });
    }

    async function handleSourceClick(e, wrapper, url) {
        // Allow browser default behavior for:
        // - Ctrl/Cmd/Shift + Click (new tab/window)
        // - Middle mouse button (button 1 = open in new tab)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;

        // Stop Icon Grid or other plugin JS from stealing the click and navigating/animating
        e.preventDefault();
        e.stopPropagation();

        // FIX: Prevent starting a new transition while one is already in progress
        if (transitionInProgress) {
            console.log('[WP Logo Explode] Transition already in progress. Ignoring click.');
            return;
        }

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

        // FIX: Set lock at start of transition
        transitionInProgress = true;

        // FIX: Reset abort flag at start of new transition
        transitionAborted = false;

        // 1. Setup Overlay
        const overlay = createOverlay();
        activeTransitionOverlay = overlay; // FIX: Track globally for emergency cleanup

        // FIX: Failsafe timeout - if transition hangs for too long, cleanup and navigate
        const failsafeTimeout = setTimeout(() => {
            console.error('[WP Logo Explode] Transition timeout! Forcing cleanup and navigation.');
            emergencyCleanup();
            window.location.href = url;
        }, TRANSITION_TIMEOUT);

        // Check if this is an Icon Grid tile (has .icon-grid-gradient)
        const isIconGridTile = !!sourceEl.querySelector('.icon-grid-gradient');

        // NEW: Check for custom animate selector or ID
        const animateSelector = sourceEl.dataset.transitionAnimateSelector;
        const animateDomId = sourceEl.dataset.transitionAnimateDomId;

        let clone, sourceRect, elementToHide;

        if (animateDomId) {
            // EXTERNAL ID: Target an element anywhere in the DOM
            const targetElement = document.getElementById(animateDomId);
            if (!targetElement) {
                console.warn('[WP Logo Explode] Animate DOM ID not found:', animateDomId);
                // Fallback to whole wrapper
                clone = sourceEl.cloneNode(true);
                sourceRect = sourceEl.getBoundingClientRect();
                elementToHide = sourceEl;
            } else {
                // Clone just the target element
                const targetRect = targetElement.getBoundingClientRect();

                // Check if it's an SVG for special handling
                if (targetElement.tagName.toLowerCase() === 'svg') {
                    // SVG: Clone and set up for scaling
                    const svgClone = targetElement.cloneNode(true);
                    svgClone.removeAttribute('width');
                    svgClone.removeAttribute('height');
                    svgClone.style.width = '100%';
                    svgClone.style.height = '100%';
                    svgClone.style.display = 'block';
                    svgClone.style.maxWidth = 'none';
                    svgClone.style.maxHeight = 'none';

                    // Check if SVG has viewBox for visual rect calculation
                    if (svgClone.viewBox?.baseVal?.width) {
                        try {
                            const bbox = targetElement.getBBox();
                            const viewBox = targetElement.viewBox.baseVal;

                            // Calculate visual content rect
                            sourceRect = {
                                left: targetRect.left + ((bbox.x - viewBox.x) / viewBox.width) * targetRect.width,
                                top: targetRect.top + ((bbox.y - viewBox.y) / viewBox.height) * targetRect.height,
                                width: (bbox.width / viewBox.width) * targetRect.width,
                                height: (bbox.height / viewBox.height) * targetRect.height
                            };

                            // Crop viewBox to visual content
                            svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
                        } catch (e) {
                            // getBBox can fail if SVG is hidden; fallback to full rect
                            sourceRect = targetRect;
                        }
                    } else {
                        sourceRect = targetRect;
                    }

                    // Wrap SVG in a div for animation
                    clone = document.createElement('div');
                    clone.classList.add('transition-clone');
                    clone.style.margin = '0';
                    clone.style.transform = 'none';
                    clone.style.overflow = 'visible';
                    clone.appendChild(svgClone);
                } else {
                    // Non-SVG element: Clone normally
                    clone = targetElement.cloneNode(true);
                    clone.classList.add('transition-clone');
                    clone.style.margin = '0';
                    clone.style.transform = 'none';
                    sourceRect = targetRect;
                }

                elementToHide = targetElement;
            }

            // Ensure clone has proper styles
            clone.classList.add('transition-clone');
            clone.style.margin = '0';
            clone.style.transform = 'none';

        } else if (animateSelector) {
            // CUSTOM SELECTOR: Clone and animate the specified nested element
            const targetElement = sourceEl.querySelector(animateSelector);
            if (!targetElement) {
                console.warn('[WP Logo Explode] Animate selector not found:', animateSelector);
                // Fallback to whole wrapper
                clone = sourceEl.cloneNode(true);
                sourceRect = sourceEl.getBoundingClientRect();
                elementToHide = sourceEl;
            } else {
                // Clone just the target element
                const targetRect = targetElement.getBoundingClientRect();

                // Check if it's an SVG for special handling
                if (targetElement.tagName.toLowerCase() === 'svg') {
                    // SVG: Clone and set up for scaling
                    const svgClone = targetElement.cloneNode(true);
                    svgClone.removeAttribute('width');
                    svgClone.removeAttribute('height');
                    svgClone.style.width = '100%';
                    svgClone.style.height = '100%';
                    svgClone.style.display = 'block';
                    svgClone.style.maxWidth = 'none';
                    svgClone.style.maxHeight = 'none';

                    // Check if SVG has viewBox for visual rect calculation
                    if (svgClone.viewBox?.baseVal?.width) {
                        try {
                            const bbox = targetElement.getBBox();
                            const viewBox = targetElement.viewBox.baseVal;

                            // Calculate visual content rect
                            sourceRect = {
                                left: targetRect.left + ((bbox.x - viewBox.x) / viewBox.width) * targetRect.width,
                                top: targetRect.top + ((bbox.y - viewBox.y) / viewBox.height) * targetRect.height,
                                width: (bbox.width / viewBox.width) * targetRect.width,
                                height: (bbox.height / viewBox.height) * targetRect.height
                            };

                            // Crop viewBox to visual content
                            svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
                        } catch (e) {
                            // getBBox can fail if SVG is hidden; fallback to full rect
                            sourceRect = targetRect;
                        }
                    } else {
                        sourceRect = targetRect;
                    }

                    // Wrap SVG in a div for animation
                    clone = document.createElement('div');
                    clone.classList.add('transition-clone');
                    clone.style.margin = '0';
                    clone.style.transform = 'none';
                    clone.style.overflow = 'visible';
                    clone.appendChild(svgClone);
                } else {
                    // Non-SVG element: Clone normally
                    clone = targetElement.cloneNode(true);
                    clone.classList.add('transition-clone');
                    clone.style.margin = '0';
                    clone.style.transform = 'none';
                    sourceRect = targetRect;
                }

                elementToHide = targetElement;
            }

            // Ensure clone has proper styles
            clone.classList.add('transition-clone');
            clone.style.margin = '0';
            clone.style.transform = 'none';

        } else if (isIconGridTile) {
            // ICON GRID: Clone SVG and wrap in div (like regular blocks)
            const gradientSvg = sourceEl.querySelector('.icon-grid-gradient');
            const fullRect = gradientSvg.getBoundingClientRect();

            // Get the tight bounding box of the actual visual content
            const bbox = gradientSvg.getBBox();
            const viewBox = gradientSvg.viewBox.baseVal;

            // Calculate where the visual content actually is on screen
            // FIX: Account for viewBox offset (vb.x, vb.y) in position calculation
            const visualRect = {
                left: fullRect.left + ((bbox.x - viewBox.x) / viewBox.width) * fullRect.width,
                top: fullRect.top + ((bbox.y - viewBox.y) / viewBox.height) * fullRect.height,
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

        // 2. Position Clone - different setup for GPU vs standard animation
        if (config.gpuAnimation) {
            // GPU MODE: Fixed size, use transform for position/scale
            clone.style.position = 'absolute';
            clone.style.width = `${sourceRect.width}px`;
            clone.style.height = `${sourceRect.height}px`;
            clone.style.left = '0px';
            clone.style.top = '0px';
            clone.style.transformOrigin = '0 0';
            clone.style.willChange = 'transform';
            clone.style.transform = `translate(${sourceRect.left}px, ${sourceRect.top}px) scale(1)`;

            // FIX: Normalize SVG viewBox to prevent offset issues during scaling
            // When viewBox doesn't start at 0,0 (e.g., "16 18 48 48"), the offset gets scaled
            const cloneSvg = clone.querySelector('svg');
            if (cloneSvg && cloneSvg.viewBox?.baseVal) {
                const vb = cloneSvg.viewBox.baseVal;

                // Force SVG to stretch to fill container exactly (no letterboxing)
                cloneSvg.setAttribute('preserveAspectRatio', 'none');

                if (vb.x !== 0 || vb.y !== 0) {
                    console.log('[WP Logo Explode] Normalizing SVG viewBox:', {
                        original: `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
                        normalized: `0 0 ${vb.width} ${vb.height}`
                    });

                    // Extract defs separately (they shouldn't be transformed)
                    const defs = cloneSvg.querySelector('defs');
                    const defsHtml = defs ? defs.outerHTML : '';
                    if (defs) defs.remove();

                    // Wrap remaining content in a group and translate to compensate for viewBox offset
                    const innerContent = cloneSvg.innerHTML;
                    cloneSvg.innerHTML = defsHtml + `<g transform="translate(${-vb.x}, ${-vb.y})">${innerContent}</g>`;
                    cloneSvg.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);
                }
            }

            console.log('[WP Logo Explode] GPU Animation mode enabled');
        } else {
            // STANDARD MODE: Animate width/height/left/top
            clone.style.willChange = 'width, height, left, top';
            clone.style.contain = 'layout style';
            setCloneStyles(clone, sourceRect);
        }

        // 3. Hide Original
        elementToHide.style.opacity = '0';

        // 4. Animate to Explode
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // In instantLoad mode, ignore block-level overrides for consistent fast behavior
        const blockScale = config.instantLoad ? null : sourceEl.closest('[data-transition-scale-explode]')?.dataset.transitionScaleExplode;
        const scaleFactor = (blockScale && !isNaN(parseFloat(blockScale)) && parseFloat(blockScale) !== 0) ? parseFloat(blockScale) : config.scaleExplode;

        const explodeW = sourceRect.width * scaleFactor;
        const explodeH = sourceRect.height * scaleFactor;

        // Calculate explode position (center of viewport)
        const explodeX = viewportW / 2 - explodeW / 2;
        const explodeY = viewportH / 2 - explodeH / 2;

        const explodeStyles = {
            width: `${explodeW}px`,
            height: `${explodeH}px`,
            left: `${explodeX}px`,
            top: `${explodeY}px`
        };

        // In instantLoad mode, ignore block-level duration overrides
        const blockDurExpand = config.instantLoad ? null : sourceEl.closest('[data-transition-duration-expand]')?.dataset.transitionDurationExpand;
        const durExpand = (blockDurExpand && !isNaN(parseInt(blockDurExpand)) && parseInt(blockDurExpand) !== 0) ? parseInt(blockDurExpand) : config.durationExpand;

        // Choose animation method based on gpuAnimation setting
        const doExpandAnimation = config.gpuAnimation
            ? () => animateWithTransform(clone, sourceRect.left, sourceRect.top, 1, explodeX, explodeY, scaleFactor, durExpand, 'cubic-bezier(0.2, 0.9, 0.2, 1)')
            : () => animateTo(clone, explodeStyles, durExpand, 'cubic-bezier(0.2, 0.9, 0.2, 1)');

        // INSTANT LOAD MODE: Run expand animation AND content fetch in PARALLEL
        if (config.instantLoad) {
            console.log('[WP Logo Explode] Instant Load mode: fetching content in parallel with animation');

            // Start both operations simultaneously
            const expandPromise = doExpandAnimation();
            const fetchPromise = loadNewContent(url, transitionId);

            // Wait for BOTH to complete
            await Promise.all([expandPromise, fetchPromise]);

            // After parallel load, ensure clone is still properly positioned at explode state
            if (config.gpuAnimation) {
                clone.style.transform = `translate(${explodeX}px, ${explodeY}px) scale(${scaleFactor})`;
            } else {
                Object.assign(clone.style, explodeStyles);
            }
        } else {
            // NORMAL MODE: Sequential - animate first, then fetch
            await doExpandAnimation();

            // FIX: Check if transition was aborted (e.g., tab switched)
            if (transitionAborted) {
                clearTimeout(failsafeTimeout);
                transitionInProgress = false; // FIX: Release lock on abort
                return;
            }

            // Fetch New Page
            await loadNewContent(url, transitionId);
        }

        // FIX: Check if transition was aborted after async operations
        if (transitionAborted) {
            clearTimeout(failsafeTimeout);
            transitionInProgress = false; // FIX: Release lock on abort
            return;
        }

        // Hide target element in preparation for shrink animation
        const preTargetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);
        if (preTargetWrapper) {
            const isTargetIconGrid = !!preTargetWrapper.querySelector('.icon-grid-gradient');
            const targetElement = isTargetIconGrid
                ? preTargetWrapper.querySelector('.icon-grid-gradient')
                : preTargetWrapper;
            if (targetElement) targetElement.style.opacity = '0';
        }

        // EARLY SIGNAL: Content is loaded, trigger re-initialization before shrink animation
        // This ensures the page is fully initialized when the logo scales down into place
        console.log('[WP Logo Explode] Content loaded. Dispatching early event and polling for hooks.');
        window.dispatchEvent(new Event('wpLogoExplodeTransitionComplete'));
        pollForHook();

        // 6. Animate Clone to Target
        // Give browser time to:
        // 1. Execute all the scripts that were re-inserted after content swap
        // 2. Calculate layout
        // 3. Let the main thread settle before starting animation
        if (config.instantLoad) {
            // In instantLoad mode: minimal delay but enough for scripts to settle
            // Use setTimeout(0) to yield to the event loop, then 2 frames for layout
            await new Promise(resolve => setTimeout(resolve, 0));
            await requestFrame();
            await requestFrame();
        } else {
            await wait(config.layoutSettleDelay);
            await requestFrame();
        }

        // Verify clone is still valid after content swap
        if (!clone.isConnected) {
            console.warn('[WP Logo Explode] Clone was disconnected during content swap. Aborting shrink animation.');
            clearTimeout(failsafeTimeout);

            // FIX: Ensure target is visible even though animation was aborted
            const targetWrapper = document.querySelector(`[data-transition-id="${transitionId}"][data-transition-role="target"]`);
            if (targetWrapper) {
                targetWrapper.style.opacity = '';
                // Also show any nested element that might have been hidden
                const isTargetIconGrid = !!targetWrapper.querySelector('.icon-grid-gradient');
                if (isTargetIconGrid) {
                    const targetSvg = targetWrapper.querySelector('.icon-grid-gradient');
                    if (targetSvg) targetSvg.style.opacity = '';
                }
            }

            emergencyCleanup(); // This also releases transitionInProgress lock
            return;
        }

        // Ensure clone is at correct explode position before shrink animation
        // Content swap may have affected the transform
        if (config.gpuAnimation) {
            clone.style.transform = `translate(${explodeX}px, ${explodeY}px) scale(${scaleFactor})`;
        } else {
            Object.assign(clone.style, explodeStyles);
        }

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

                const finalX = targetRect.left + offsetX;
                const finalY = targetRect.top + offsetY;
                const finalStyles = {
                    width: `${targetRect.width}px`,
                    height: `${targetRect.height}px`,
                    left: `${finalX}px`,
                    top: `${finalY}px`
                };

                // In instantLoad mode, ignore block-level duration overrides
                const blockDurShrink = config.instantLoad ? null : sourceEl.closest('[data-transition-duration-shrink]')?.dataset.transitionDurationShrink;
                const durShrink = (blockDurShrink && !isNaN(parseInt(blockDurShrink)) && parseInt(blockDurShrink) !== 0) ? parseInt(blockDurShrink) : config.durationShrink;

                // Shrink animation - GPU or standard
                if (config.gpuAnimation) {
                    // GPU MODE: Use transform with separate scaleX/scaleY for exact sizing
                    const targetScaleX = targetRect.width / sourceRect.width;
                    const targetScaleY = targetRect.height / sourceRect.height;

                    console.log('[WP Logo Explode] GPU Shrink:', {
                        from: { x: explodeX, y: explodeY, scale: scaleFactor },
                        to: { x: finalX, y: finalY, scaleX: targetScaleX, scaleY: targetScaleY },
                        targetRect: { w: targetRect.width, h: targetRect.height, l: targetRect.left, t: targetRect.top },
                        sourceRect: { w: sourceRect.width, h: sourceRect.height }
                    });

                    await animateWithTransformXY(clone, explodeX, explodeY, scaleFactor, scaleFactor, finalX, finalY, targetScaleX, targetScaleY, durShrink, 'cubic-bezier(0.2, 0, 0.2, 1)');
                } else {
                    // STANDARD MODE: Animate width/height/left/top
                    await animateTo(clone, finalStyles, durShrink, 'cubic-bezier(0.2, 0, 0.2, 1)');
                }

                // FIX: Clear failsafe timeout IMMEDIATELY after successful animation
                // BEFORE any hooks/events that might take a long time
                clearTimeout(failsafeTimeout);

                // Show the WRAPPER again
                targetWrapper.style.opacity = '';

                // SIGNAL TRANSITION COMPLETE
                console.log('[WP Logo Explode] Transition complete. Dispatching event and polling for hooks.');

                // 1. Dispatch custom event
                window.dispatchEvent(new Event('wpLogoExplodeTransitionComplete'));

                // 2. Poll for global hook (supports delayed script loading)
                pollForHook();
            }
        } else {
            // FIX: If no target found, log detailed error and cleanup properly
            console.warn('[WP Logo Explode] Target element not found for transition:', transitionId);
            console.warn('[WP Logo Explode] Expected: [data-transition-id="' + transitionId + '"][data-transition-role="target"]');

            // Clear timeout before fadeout
            clearTimeout(failsafeTimeout);

            // Fade out clone gracefully
            await new Promise(resolve => {
                const fadeAnim = clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
                fadeAnim.onfinish = resolve;
                // FIX: Timeout fallback in case animation doesn't fire onfinish
                setTimeout(resolve, 400);
            });

            // Still dispatch events so page initializes correctly
            console.log('[WP Logo Explode] Dispatching events after fadeout (no target found).');
            window.dispatchEvent(new Event('wpLogoExplodeTransitionComplete'));
            pollForHook();
        }

        // Clean up will-change to free GPU memory
        clone.style.willChange = 'auto';
        if (config.gpuAnimation) {
            clone.style.transform = 'none';
        }

        // FIX: Clear global overlay reference
        activeTransitionOverlay = null;

        // FIX: Release transition lock
        transitionInProgress = false;

        overlay.remove();
    }

    /**
     * Polls for window.initializeOnPageCanvasAfterTransition
     * Retries for up to 2 seconds to allow scripts to load.
     */
    function pollForHook(attempts = 0) {
        if (typeof window.initializeOnPageCanvasAfterTransition === 'function') {
            console.log('[WP Logo Explode] Found window.initializeOnPageCanvasAfterTransition. Executing...');
            window.initializeOnPageCanvasAfterTransition();
            // Clear the hook after execution to prevent double-triggering if polled again
            window.initializeOnPageCanvasAfterTransition = null;
            return;
        }

        // Max 20 attempts * 100ms = 2 seconds
        if (attempts < 20) {
            if (attempts === 0) {
                console.log('[WP Logo Explode] Hook not found immediately. Polling...');
            }
            setTimeout(() => pollForHook(attempts + 1), 100);
        } else {
            console.log('[WP Logo Explode] No window.initializeOnPageCanvasAfterTransition hook found after 2 seconds.');
        }
    }

    async function loadNewContent(url, transitionId) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(text, 'text/html');

            // Clear any previous transition hooks to prevent calling stale handlers
            window.initializeOnPageCanvasAfterTransition = null;

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
            // Preserve Overlay - use global reference for reliability
            const overlay = activeTransitionOverlay || document.querySelector('.transition-overlay');
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }

            document.body.innerHTML = newDoc.body.innerHTML;

            // Restore Overlay - ensure it's appended back to body
            if (overlay) {
                document.body.appendChild(overlay);
            }

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
            console.error('[WP Logo Explode] Transition Failed:', err);
            // FIX: Cleanup overlay before fallback navigation (also releases lock)
            emergencyCleanup();
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
            let resolved = false;

            const finish = () => {
                if (resolved) return;
                resolved = true;
                // Cancel animation to free resources
                if (animation) {
                    try { animation.cancel(); } catch (e) {}
                }
                Object.assign(element.style, styles);
                resolve();
            };

            // Check if element is still in DOM
            // Note: We only check isConnected, not offsetParent, because elements inside
            // position:fixed overlays may have null offsetParent but still be visible
            if (!element.isConnected) {
                console.warn('[WP Logo Explode] Animation target not connected to DOM. Skipping animation.');
                Object.assign(element.style, styles);
                resolve();
                return;
            }

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

            animation.onfinish = finish;
            animation.oncancel = finish;

            // FIX: Timeout fallback in case onfinish never fires
            // (e.g., element removed, tab hidden, browser quirk)
            // Reduced buffer from 500ms to 100ms for faster recovery
            setTimeout(finish, safeDuration + 100);
        });
    }

    /**
     * GPU-accelerated animation using transform (scale + translate)
     * Runs on compositor thread, independent of main thread JavaScript
     *
     * @param {HTMLElement} element - The element to animate
     * @param {number} fromX - Start X position
     * @param {number} fromY - Start Y position
     * @param {number} fromScale - Start scale (1 = original size)
     * @param {number} toX - End X position
     * @param {number} toY - End Y position
     * @param {number} toScale - End scale
     * @param {number} duration - Animation duration in ms
     * @param {string} easing - CSS easing function
     */
    function animateWithTransform(element, fromX, fromY, fromScale, toX, toY, toScale, duration, easing) {
        const safeDuration = (isNaN(duration) || duration < 0) ? 0 : duration;

        return new Promise(resolve => {
            let resolved = false;

            const finish = () => {
                if (resolved) return;
                resolved = true;
                if (animation) {
                    try { animation.cancel(); } catch (e) {}
                }
                // Set final transform
                element.style.transform = `translate(${toX}px, ${toY}px) scale(${toScale})`;
                resolve();
            };

            if (!element.isConnected) {
                console.warn('[WP Logo Explode] GPU animation target not connected. Skipping.');
                element.style.transform = `translate(${toX}px, ${toY}px) scale(${toScale})`;
                resolve();
                return;
            }

            const animation = element.animate([
                { transform: `translate(${fromX}px, ${fromY}px) scale(${fromScale})` },
                { transform: `translate(${toX}px, ${toY}px) scale(${toScale})` }
            ], {
                duration: safeDuration,
                easing: easing,
                fill: 'forwards'
            });

            animation.onfinish = finish;
            animation.oncancel = finish;
            setTimeout(finish, safeDuration + 100);
        });
    }

    /**
     * GPU-accelerated animation with separate X/Y scaling for exact target sizing
     * Uses scale(scaleX, scaleY) for non-uniform scaling
     */
    function animateWithTransformXY(element, fromX, fromY, fromScaleX, fromScaleY, toX, toY, toScaleX, toScaleY, duration, easing) {
        const safeDuration = (isNaN(duration) || duration < 0) ? 0 : duration;

        return new Promise(resolve => {
            let resolved = false;

            const finish = () => {
                if (resolved) return;
                resolved = true;
                if (animation) {
                    try { animation.cancel(); } catch (e) {}
                }
                element.style.transform = `translate(${toX}px, ${toY}px) scale(${toScaleX}, ${toScaleY})`;
                resolve();
            };

            if (!element.isConnected) {
                console.warn('[WP Logo Explode] GPU animation target not connected. Skipping.');
                element.style.transform = `translate(${toX}px, ${toY}px) scale(${toScaleX}, ${toScaleY})`;
                resolve();
                return;
            }

            const animation = element.animate([
                { transform: `translate(${fromX}px, ${fromY}px) scale(${fromScaleX}, ${fromScaleY})` },
                { transform: `translate(${toX}px, ${toY}px) scale(${toScaleX}, ${toScaleY})` }
            ], {
                duration: safeDuration,
                easing: easing,
                fill: 'forwards'
            });

            animation.onfinish = finish;
            animation.oncancel = finish;
            setTimeout(finish, safeDuration + 100);
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function requestFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

})();
