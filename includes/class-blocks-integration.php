<?php
/**
 * Handles Gutenberg Block Integration
 * 
 * Registers transition attributes for all blocks and injects them into
 * dynamically rendered blocks (like Kadence Row Layout) via render_block filter.
 */

class WP_Logo_Explode_Blocks_Integration {

	/**
	 * Blocks that use dynamic (server-side) rendering and need attribute injection
	 */
	private $dynamic_blocks = array(
		'kadence/rowlayout',
		'kadence/column',
		'kadence/advancedgallery',
		'kadence/tabs',
		'kadence/accordion',
		'generateblocks/container',
		'generateblocks/grid',
	);

	public function __construct() {
		// Register attributes for ALL blocks
		add_filter( 'register_block_type_args', array( $this, 'register_block_attributes' ), 10, 2 );
		
		// Inject attributes into dynamically rendered blocks
		add_filter( 'render_block', array( $this, 'inject_transition_attributes' ), 10, 2 );
	}

	/**
	 * Register transition attributes for all blocks
	 */
	public function register_block_attributes( $args, $block_type ) {
		if ( ! isset( $args['attributes'] ) ) {
			$args['attributes'] = array();
		}

		// Core transition attributes
		$args['attributes']['transitionId'] = array(
			'type'    => 'string',
			'default' => '',
		);

		$args['attributes']['transitionRole'] = array(
			'type'    => 'string',
			'default' => '', // 'source' or 'target'
		);

		$args['attributes']['transitionLink'] = array(
			'type'    => 'string',
			'default' => '',
		);

		$args['attributes']['transitionColor'] = array(
			'type'    => 'string',
			'default' => '',
		);

		// NEW: Animate selector - CSS selector for nested element to animate
		$args['attributes']['transitionAnimateSelector'] = array(
			'type'    => 'string',
			'default' => '',
		);

		// NEW: Animate element by DOM ID (anywhere in page)
		$args['attributes']['transitionAnimateDomId'] = array(
			'type'    => 'string',
			'default' => '',
		);

		// Animation overrides
		$args['attributes']['offsetX'] = array(
			'type'    => 'number',
			'default' => 0,
		);

		$args['attributes']['offsetY'] = array(
			'type'    => 'number',
			'default' => 0,
		);

		$args['attributes']['durationExpand'] = array(
			'type'    => 'number',
			'default' => 0,
		);

		$args['attributes']['durationShrink'] = array(
			'type'    => 'number',
			'default' => 0,
		);

		$args['attributes']['scaleExplode'] = array(
			'type'    => 'number',
			'default' => 0,
		);

		// NEW: SEO link attributes
		$args['attributes']['linkAriaLabel'] = array(
			'type'    => 'string',
			'default' => '',
		);

		$args['attributes']['linkTitle'] = array(
			'type'    => 'string',
			'default' => '',
		);

		$args['attributes']['linkRel'] = array(
			'type'    => 'string',
			'default' => '',
		);

		return $args;
	}

	/**
	 * Inject data-transition-* attributes into dynamically rendered blocks
	 */
	public function inject_transition_attributes( $block_content, $block ) {
		// Only process if block has transition attributes set
		$attrs = $block['attrs'] ?? array();
		$transition_id = $attrs['transitionId'] ?? '';
		$transition_role = $attrs['transitionRole'] ?? '';

		if ( empty( $transition_id ) || empty( $transition_role ) ) {
			return $block_content;
		}

		// Build data attributes string
		$data_attrs = array();
		$data_attrs[] = 'data-transition-id="' . esc_attr( $transition_id ) . '"';
		$data_attrs[] = 'data-transition-role="' . esc_attr( $transition_role ) . '"';

		if ( $transition_role === 'source' && ! empty( $attrs['transitionLink'] ) ) {
			$data_attrs[] = 'data-transition-link="' . esc_url( $attrs['transitionLink'] ) . '"';
		}

		if ( ! empty( $attrs['transitionColor'] ) ) {
			$data_attrs[] = 'data-transition-color="' . esc_attr( $attrs['transitionColor'] ) . '"';
		}

		if ( ! empty( $attrs['transitionAnimateSelector'] ) ) {
			$data_attrs[] = 'data-transition-animate-selector="' . esc_attr( $attrs['transitionAnimateSelector'] ) . '"';
		}

		if ( ! empty( $attrs['transitionAnimateDomId'] ) ) {
			$data_attrs[] = 'data-transition-animate-dom-id="' . esc_attr( $attrs['transitionAnimateDomId'] ) . '"';
		}

		if ( ! empty( $attrs['durationExpand'] ) ) {
			$data_attrs[] = 'data-transition-duration-expand="' . intval( $attrs['durationExpand'] ) . '"';
		}

		if ( ! empty( $attrs['durationShrink'] ) ) {
			$data_attrs[] = 'data-transition-duration-shrink="' . intval( $attrs['durationShrink'] ) . '"';
		}

		if ( ! empty( $attrs['scaleExplode'] ) ) {
			$data_attrs[] = 'data-transition-scale-explode="' . floatval( $attrs['scaleExplode'] ) . '"';
		}

		if ( $transition_role === 'target' ) {
			if ( ! empty( $attrs['offsetX'] ) ) {
				$data_attrs[] = 'data-transition-offset-x="' . intval( $attrs['offsetX'] ) . '"';
			}
			if ( ! empty( $attrs['offsetY'] ) ) {
				$data_attrs[] = 'data-transition-offset-y="' . intval( $attrs['offsetY'] ) . '"';
			}
		}

		$data_attrs_string = implode( ' ', $data_attrs );

		// Inject attributes into the first opening tag
		// Match the first HTML tag (div, section, etc.)
		$pattern = '/^(\s*<\w+)(\s|>)/';
		$replacement = '$1 ' . $data_attrs_string . '$2';
		$block_content = preg_replace( $pattern, $replacement, $block_content, 1 );

		// Add fallback link for no-JS clients (source blocks only)
		if ( $transition_role === 'source' && ! empty( $attrs['transitionLink'] ) ) {
			$block_content = $this->inject_fallback_link( $block_content, $attrs );
		}

		return $block_content;
	}

	/**
	 * Inject an overlay link for proper link behavior (middle-click, right-click, no-JS fallback)
	 */
	private function inject_fallback_link( $block_content, $attrs ) {
		$link_url = esc_url( $attrs['transitionLink'] );
		$aria_label = ! empty( $attrs['linkAriaLabel'] ) ? esc_attr( $attrs['linkAriaLabel'] ) : __( 'Navigate to page', 'wp-logo-explode' );
		$link_title = ! empty( $attrs['linkTitle'] ) ? ' title="' . esc_attr( $attrs['linkTitle'] ) . '"' : '';
		$link_rel = ! empty( $attrs['linkRel'] ) ? ' rel="' . esc_attr( $attrs['linkRel'] ) . '"' : '';

		// Create an overlay link that covers the entire block
		// This enables:
		// - Middle mouse button (open in new tab)
		// - Right-click context menu
		// - No-JS fallback
		// - Proper link semantics for SEO and accessibility
		$fallback_link = sprintf(
			'<a href="%s" class="wp-logo-explode-overlay-link" aria-label="%s"%s%s><span class="screen-reader-text">%s</span></a>',
			$link_url,
			$aria_label,
			$link_title,
			$link_rel,
			$aria_label
		);

		// Insert the overlay link right after the opening tag
		$pattern = '/^(\s*<\w+[^>]*>)/';
		$replacement = '$1' . $fallback_link;
		$block_content = preg_replace( $pattern, $replacement, $block_content, 1 );

		// Ensure the wrapper has position: relative for the overlay to work
		// We inject a style attribute or add to existing one
		$block_content = preg_replace(
			'/^(\s*<\w+)(\s+[^>]*style="[^"]*")/',
			'$1$2',
			$block_content,
			1,
			$count
		);

		if ( $count === 0 ) {
			// No style attribute found, add position relative via a new style attribute
			$block_content = preg_replace(
				'/^(\s*<\w+)(\s+[^>]*)>/',
				'$1$2 style="position: relative;">',
				$block_content,
				1
			);
		} else {
			// Style attribute exists, append position: relative if not present
			if ( strpos( $block_content, 'position:' ) === false && strpos( $block_content, 'position :' ) === false ) {
				$block_content = preg_replace(
					'/^(\s*<\w+\s+[^>]*style=")([^"]*)(")/U',
					'$1$2 position: relative;$3',
					$block_content,
					1
				);
			}
		}

		return $block_content;
	}
}

new WP_Logo_Explode_Blocks_Integration();
