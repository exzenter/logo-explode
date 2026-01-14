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

	// Localize Settings
	$options = get_option( 'wp_logo_explode_settings', array() );
	$defaults = array(
		'durationExpand'   => 800,
		'durationShrink'   => 800,
		'scaleExplode'     => 100,
		'layoutSettleDelay' => 200,
		'zIndex'           => 99999,
		'forceScrollTop'   => true,
		'globalBgColor'    => '',
	);
	$settings = array_merge( $defaults, $options );

	wp_localize_script( 'wp-logo-explode-js', 'wpLogoExplodeSettings', $settings );

	// Add inline script to toggle 'js' class for fallback link detection
	wp_add_inline_script( 'wp-logo-explode-js', "document.documentElement.classList.add('js');document.documentElement.classList.remove('no-js');", 'before' );
}
add_action( 'wp_enqueue_scripts', 'wp_logo_explode_enqueue_assets' );

/**
 * Register Settings
 */
function wp_logo_explode_register_settings() {
	register_setting( 'wp_logo_explode_options', 'wp_logo_explode_settings' );
}
add_action( 'admin_init', 'wp_logo_explode_register_settings' );

/**
 * Add Admin Menu
 */
function wp_logo_explode_add_admin_menu() {
	add_options_page(
		__( 'WP Logo Explode Settings', 'wp-logo-explode' ),
		__( 'Logo Explode', 'wp-logo-explode' ),
		'manage_options',
		'wp-logo-explode',
		'wp_logo_explode_settings_page_html'
	);
}
add_action( 'admin_menu', 'wp_logo_explode_add_admin_menu' );

/**
 * Settings Page HTML
 */
function wp_logo_explode_settings_page_html() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$options = get_option( 'wp_logo_explode_settings', array() );
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'wp_logo_explode_options' );
			do_settings_sections( 'wp_logo_explode_options' );
			?>
			<table class="form-table">
				<tr valign="top">
					<th scope="row"><?php _e( 'Default Expansion Duration (ms)', 'wp-logo-explode' ); ?></th>
					<td><input type="number" name="wp_logo_explode_settings[durationExpand]" value="<?php echo esc_attr( $options['durationExpand'] ?? 800 ); ?>" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Default Shrink Duration (ms)', 'wp-logo-explode' ); ?></th>
					<td><input type="number" name="wp_logo_explode_settings[durationShrink]" value="<?php echo esc_attr( $options['durationShrink'] ?? 800 ); ?>" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Default Explosion Scale', 'wp-logo-explode' ); ?></th>
					<td><input type="number" name="wp_logo_explode_settings[scaleExplode]" value="<?php echo esc_attr( $options['scaleExplode'] ?? 100 ); ?>" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Layout Settle Delay (ms)', 'wp-logo-explode' ); ?></th>
					<td><input type="number" name="wp_logo_explode_settings[layoutSettleDelay]" value="<?php echo esc_attr( $options['layoutSettleDelay'] ?? 200 ); ?>" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Overlay Z-Index', 'wp-logo-explode' ); ?></th>
					<td><input type="number" name="wp_logo_explode_settings[zIndex]" value="<?php echo esc_attr( $options['zIndex'] ?? 99999 ); ?>" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Global Background Color', 'wp-logo-explode' ); ?></th>
					<td><input type="text" name="wp_logo_explode_settings[globalBgColor]" value="<?php echo esc_attr( $options['globalBgColor'] ?? '' ); ?>" class="wp-color-picker" /></td>
				</tr>
				<tr valign="top">
					<th scope="row"><?php _e( 'Force Scroll to Top', 'wp-logo-explode' ); ?></th>
					<td>
						<input type="checkbox" name="wp_logo_explode_settings[forceScrollTop]" value="1" <?php checked( $options['forceScrollTop'] ?? true, true ); ?> />
						<p class="description"><?php _e( 'Recommended to ensure the logo positions correctly on the new page.', 'wp-logo-explode' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<script>
		jQuery(document).ready(function($){
			$('.wp-color-picker').wpColorPicker();
		});
	</script>
	<?php
}

/**
 * Enqueue Color Picker for Admin
 */
function wp_logo_explode_admin_assets($hook) {
    if ('settings_page_wp-logo-explode' !== $hook) {
        return;
    }
    wp_enqueue_style('wp-color-picker');
    wp_enqueue_script('wp-logo-explode-admin-js', WP_LOGO_EXPLODE_URL . 'assets/js/admin-settings.js', array('wp-color-picker'), WP_LOGO_EXPLODE_VERSION, true);
}
add_action('admin_enqueue_scripts', 'wp_logo_explode_admin_assets');

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
