/**
 * WP Logo Explode - Linked Icon Grid Handler
 * Handles hover/click linking between blocks and Icon Grid tiles
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        initLinkedIconGrids();
        initLinkedAnimateElements();
    });

    function initLinkedIconGrids() {
        // Find all blocks with link-icon-grid enabled
        const linkedBlocks = document.querySelectorAll('[data-link-icon-grid="true"]');

        if (linkedBlocks.length === 0) return;

        linkedBlocks.forEach(block => {
            const transitionId = block.dataset.transitionId;
            const instanceNum = parseInt(block.dataset.iconGridInstance) || 1;

            if (!transitionId) return;

            // Find the matching icon grid tile
            const tile = findIconGridTile(transitionId, instanceNum);

            if (!tile) {
                console.warn('[WP Logo Explode] Could not find Icon Grid tile with transition ID:', transitionId, 'instance:', instanceNum);
                return;
            }

            // Store reference for click handler
            block._linkedTile = tile;

            // Store reverse reference for bi-directional hover
            if (!tile._linkedBlocks) {
                tile._linkedBlocks = [];
            }
            tile._linkedBlocks.push(block);

            // Hover: trigger tile highlight
            block.addEventListener('mouseenter', () => handleBlockHover(block, tile, true));
            block.addEventListener('mouseleave', () => handleBlockHover(block, tile, false));

            // Reverse hover: when tile is hovered, highlight the linked block
            tile.addEventListener('mouseenter', () => handleTileHover(tile, true));
            tile.addEventListener('mouseleave', () => handleTileHover(tile, false));

            // Click: trigger tile's link with transition animation
            block.addEventListener('click', (e) => handleBlockClick(e, block, tile));

            // Add cursor pointer to indicate clickable
            block.style.cursor = 'pointer';
        });
    }

    /**
     * Find an Icon Grid tile by transition ID and grid instance number
     */
    function findIconGridTile(transitionId, instanceNum) {
        // Get all icon grid blocks
        const iconGrids = document.querySelectorAll('.wp-block-icon-grid-unlimited-icon-grid');

        if (iconGrids.length === 0) return null;

        // Get the specific instance (1-based)
        const targetGrid = iconGrids[instanceNum - 1];

        if (!targetGrid) {
            console.warn('[WP Logo Explode] Icon Grid instance', instanceNum, 'not found. Total grids on page:', iconGrids.length);
            return null;
        }

        // Find tile with matching transition ID within this grid
        const tile = targetGrid.querySelector(`[data-transition-id="${transitionId}"]`);

        return tile;
    }

    /**
     * Handle hover on linked block - trigger tile highlight
     */
    function handleBlockHover(block, tile, isEnter) {
        // Add/remove active class on the block for CSS styling
        if (isEnter) {
            block.classList.add('is-icon-grid-linked-active');
        } else {
            block.classList.remove('is-icon-grid-linked-active');
        }

        // Trigger tile highlight via the exposed API
        if (window.iconGridUnlimited) {
            if (isEnter) {
                window.iconGridUnlimited.highlightTile(tile);
            } else {
                window.iconGridUnlimited.unhighlightTile(tile);
            }
        } else {
            // Fallback: manually add/remove class
            const cell = tile.querySelector('.icon-grid-cell');
            if (cell) {
                if (isEnter) {
                    cell.classList.add('external-hover');
                } else {
                    cell.classList.remove('external-hover');
                }
            }
        }
    }

    /**
     * Handle click on linked block - trigger tile's link with transition
     */
    function handleBlockClick(e, block, tile) {
        // Don't intercept modifier key clicks
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;

        e.preventDefault();
        e.stopPropagation();

        // Get the link URL from the tile
        const linkUrl = tile.dataset.transitionLink || tile.querySelector('a')?.href;

        if (!linkUrl) {
            console.warn('[WP Logo Explode] No link URL found on tile');
            return;
        }

        // Create a synthetic click event on the tile to trigger the transition engine
        // The transition engine will handle the animation from the tile's position
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });

        // Trigger the transition from the tile
        tile.dispatchEvent(clickEvent);
    }

    /**
     * Handle hover on icon grid tile - trigger linked block hover effect
     */
    function handleTileHover(tile, isEnter) {
        // Get all blocks linked to this tile
        const linkedBlocks = tile._linkedBlocks || [];

        linkedBlocks.forEach(block => {
            if (isEnter) {
                block.classList.add('is-externally-hovered');
            } else {
                block.classList.remove('is-externally-hovered');
            }
        });
    }

    /**
     * Initialize hover linking for elements with animate-dom-id or animate-selector
     * pointing to explode SVG blocks
     */
    function initLinkedAnimateElements() {
        // Find all elements with transition-animate-dom-id or transition-animate-selector
        const elementsWithAnimate = document.querySelectorAll('[data-transition-animate-dom-id], [data-transition-animate-selector]');

        if (elementsWithAnimate.length === 0) return;

        elementsWithAnimate.forEach(sourceElement => {
            const animateDomId = sourceElement.dataset.transitionAnimateDomId;
            const animateSelector = sourceElement.dataset.transitionAnimateSelector;

            let targetElements = [];

            // Find target element(s) by DOM ID
            if (animateDomId) {
                const target = document.getElementById(animateDomId);
                if (target) targetElements.push(target);
            }

            // Find target element(s) by CSS selector (within the source element)
            if (animateSelector) {
                const targets = sourceElement.querySelectorAll(animateSelector);
                targetElements.push(...targets);
            }

            // Filter to only explode SVG blocks
            const explodeSvgBlocks = targetElements.filter(el =>
                el.classList.contains('wp-block-explodesvg-container') ||
                el.classList.contains('wp-block-wp-logo-explode-explodesvg')
            );

            if (explodeSvgBlocks.length === 0) return;

            // Set up bi-directional hover for each explode SVG block
            explodeSvgBlocks.forEach(explodeBlock => {
                // Store bi-directional references
                if (!sourceElement._linkedExplodeBlocks) {
                    sourceElement._linkedExplodeBlocks = [];
                }
                sourceElement._linkedExplodeBlocks.push(explodeBlock);

                if (!explodeBlock._linkedSourceElements) {
                    explodeBlock._linkedSourceElements = [];
                }
                explodeBlock._linkedSourceElements.push(sourceElement);

                // Forward: source element hover → explode block hover
                sourceElement.addEventListener('mouseenter', () => handleSourceElementHover(sourceElement, true));
                sourceElement.addEventListener('mouseleave', () => handleSourceElementHover(sourceElement, false));

                // Reverse: explode block hover → source element hover (optional visual feedback)
                explodeBlock.addEventListener('mouseenter', () => handleExplodeBlockHover(explodeBlock, true));
                explodeBlock.addEventListener('mouseleave', () => handleExplodeBlockHover(explodeBlock, false));
            });
        });
    }

    /**
     * Handle hover on source element - trigger explode block hover
     */
    function handleSourceElementHover(sourceElement, isEnter) {
        const linkedBlocks = sourceElement._linkedExplodeBlocks || [];

        linkedBlocks.forEach(block => {
            if (isEnter) {
                block.classList.add('is-externally-hovered');
            } else {
                block.classList.remove('is-externally-hovered');
            }
        });
    }

    /**
     * Handle hover on explode block - trigger source element visual feedback (optional)
     */
    function handleExplodeBlockHover(explodeBlock, isEnter) {
        const linkedSources = explodeBlock._linkedSourceElements || [];

        linkedSources.forEach(source => {
            if (isEnter) {
                source.classList.add('is-linked-explode-active');
            } else {
                source.classList.remove('is-linked-explode-active');
            }
        });
    }
})();
