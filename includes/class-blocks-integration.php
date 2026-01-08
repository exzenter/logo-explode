<?php
/**
 * Handles Gutenberg Block Integration
 */

class WP_Logo_Explode_Blocks_Integration {

	public function __construct() {
		// Register attributes for ALL blocks (we filter in JS, but register broadly)
		// Specifically targeting 'core/image' and 'gutenberg-bem/svg-block'
		add_filter( 'register_block_type_args', array( $this, 'register_block_attributes' ), 10, 2 );
	}

	/**
	 * Register 'transitionId', 'transitionRole', 'transitionLink' attributes
	 */
	public function register_block_attributes( $args, $block_type ) {
		// We can target specific blocks or all. Let's add support generally 
		// but typically we'd check if ( $block_type === 'core/image' ...)
		
		if ( ! isset( $args['attributes'] ) ) {
			$args['attributes'] = array();
		}

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
			'default' => 0, // 0 means use global default
		);

		$args['attributes']['durationShrink'] = array(
			'type'    => 'number',
			'default' => 0, // 0 means use global default
		);

		$args['attributes']['scaleExplode'] = array(
			'type'    => 'number',
			'default' => 0, // 0 means use global default
		);

		return $args;
	}
}

new WP_Logo_Explode_Blocks_Integration();
