<?php
/**
 * Plugin Name: WP Logo Explode
 * Description: Seamless "Vector Overlay" page transitions for SVG logos.
 * Version: 1.0.0
 * Author: Antigravity
 * Text Domain: wp-logo-explode
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Constants
define( 'WP_LOGO_EXPLODE_VERSION', '1.0.0' );
define( 'WP_LOGO_EXPLODE_PATH', plugin_dir_path( __FILE__ ) );
define( 'WP_LOGO_EXPLODE_URL', plugin_dir_url( __FILE__ ) );

/**
 * Enqueue Frontend Assets
 */
function wp_logo_explode_enqueue_assets() {
	wp_enqueue_style(
		'wp-logo-explode-css',
		WP_LOGO_EXPLODE_URL . 'assets/css/transition-styles.css',
		array(),
		WP_LOGO_EXPLODE_VERSION
	);

	wp_enqueue_script(
		'wp-logo-explode-js',
		WP_LOGO_EXPLODE_URL . 'assets/js/transition-engine.js',
		array(),
		WP_LOGO_EXPLODE_VERSION,
		true // Footer
	);
}
add_action( 'wp_enqueue_scripts', 'wp_logo_explode_enqueue_assets' );

/**
 * Enqueue Editor Assets (for Gutenberg sidebar)
 */
function wp_logo_explode_enqueue_editor_assets() {
	wp_enqueue_script(
		'wp-logo-explode-editor',
		WP_LOGO_EXPLODE_URL . 'build/index.js', // We will compile src/index.js to here
		array( 'wp-blocks', 'wp-dom-ready', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-compose', 'wp-hooks' ),
		WP_LOGO_EXPLODE_VERSION,
		true
	);
}
add_action( 'enqueue_block_editor_assets', 'wp_logo_explode_enqueue_editor_assets' );

/**
 * Load Blocks Integration (Server-side attributes)
 */
require_once WP_LOGO_EXPLODE_PATH . 'includes/class-blocks-integration.php';
