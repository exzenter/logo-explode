import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/blockEditor';
import { PanelBody, TextareaControl, TextControl, ColorPalette, RangeControl, ToggleControl, SelectControl } from '@wordpress/components';
import { Fragment } from '@wordpress/element';

/**
 * Editor Component
 */
export default function Edit({ attributes, setAttributes }) {
	const {
		svgCode,
		width = '3rem',
		height = '3rem',
		blockId,
		outlineColor = '#696969',
		outlineWidth = 1,
		disableOutline,
		gradientStart = '#000000',
		gradientEnd = '#000000',
		gradientAngle = 45,
		useOriginalFill = true,
		reverseHover,
		transitionId,
		alignSelf = 'auto',
		justifySelf = 'auto',
	} = attributes;

	const blockProps = useBlockProps({
		className: `wp-block-wp-logo-explode-explodesvg wp-block-explodesvg-container ${useOriginalFill ? 'has-original-fill' : 'has-custom-gradient'} ${reverseHover ? 'reverse-hover' : ''}`,
		style: {
			width,
			height,
			'--esvg-stroke-color': outlineColor,
			'--esvg-stroke-width': `${outlineWidth}px`,
			position: 'relative',
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			alignSelf: alignSelf !== 'auto' ? alignSelf : undefined,
			justifySelf: justifySelf !== 'auto' ? justifySelf : undefined,
		},
	});

	const getPreviewSvg = () => {
		if (!svgCode) return null;
		return (
			<div
				className="explodesvg-editor-preview"
				style={{
					width,
					height,
					'--esvg-stroke-color': outlineColor,
					'--esvg-stroke-width': `${outlineWidth}px`,
				}}
				dangerouslySetInnerHTML={{ __html: svgCode }}
			/>
		);
	};

	return (
		<div {...blockProps}>
			<InspectorControls>
				<PanelBody title={__('SVG Content', 'wp-logo-explode')}>
					<TextareaControl
						label={__('SVG XML Code', 'wp-logo-explode')}
						help={__('Paste your raw SVG code here.', 'wp-logo-explode')}
						value={svgCode}
						onChange={(value) => setAttributes({ svgCode: value })}
						rows={10}
					/>
				</PanelBody>

				<PanelBody title={__('Size', 'wp-logo-explode')} initialOpen={false}>
					<TextControl
						label={__('Width', 'wp-logo-explode')}
						value={width}
						onChange={(value) => setAttributes({ width: value })}
						placeholder="3rem"
					/>
					<TextControl
						label={__('Height', 'wp-logo-explode')}
						value={height}
						onChange={(value) => setAttributes({ height: value })}
						placeholder="3rem"
					/>
					<TextControl
						label={__('Block ID', 'wp-logo-explode')}
						help={__('Optional ID for the wrapper (e.g. for transitions).', 'wp-logo-explode')}
						value={blockId}
						onChange={(value) => setAttributes({ blockId: value })}
						placeholder=""
					/>
				</PanelBody>

				<PanelBody title={__('Alignment', 'wp-logo-explode')} initialOpen={false}>
					<SelectControl
						label={__('Align Self', 'wp-logo-explode')}
						help={__('Vertical alignment within flex/grid container', 'wp-logo-explode')}
						value={alignSelf}
						onChange={(value) => setAttributes({ alignSelf: value })}
						options={[
							{ label: __('Auto', 'wp-logo-explode'), value: 'auto' },
							{ label: __('Start', 'wp-logo-explode'), value: 'flex-start' },
							{ label: __('Center', 'wp-logo-explode'), value: 'center' },
							{ label: __('End', 'wp-logo-explode'), value: 'flex-end' },
							{ label: __('Stretch', 'wp-logo-explode'), value: 'stretch' },
							{ label: __('Baseline', 'wp-logo-explode'), value: 'baseline' },
						]}
					/>
					<SelectControl
						label={__('Justify Self', 'wp-logo-explode')}
						help={__('Horizontal alignment within grid container', 'wp-logo-explode')}
						value={justifySelf}
						onChange={(value) => setAttributes({ justifySelf: value })}
						options={[
							{ label: __('Auto', 'wp-logo-explode'), value: 'auto' },
							{ label: __('Start', 'wp-logo-explode'), value: 'start' },
							{ label: __('Center', 'wp-logo-explode'), value: 'center' },
							{ label: __('End', 'wp-logo-explode'), value: 'end' },
							{ label: __('Stretch', 'wp-logo-explode'), value: 'stretch' },
						]}
					/>
				</PanelBody>

				<PanelBody title={__('Outline Settings', 'wp-logo-explode')} initialOpen={false}>
					<ToggleControl
						label={__('Disable Outline', 'wp-logo-explode')}
						checked={disableOutline}
						onChange={(value) => setAttributes({ disableOutline: value })}
					/>
					{!disableOutline && (
						<Fragment>
							<p>{__('Outline Color', 'wp-logo-explode')}</p>
							<ColorPalette
								value={outlineColor}
								onChange={(value) => setAttributes({ outlineColor: value })}
							/>
							<RangeControl
								label={__('Outline Width', 'wp-logo-explode')}
								value={outlineWidth}
								onChange={(value) => setAttributes({ outlineWidth: value })}
								min={0}
								max={20}
							/>
						</Fragment>
					)}
				</PanelBody>

				<PanelBody title={__('Gradient Settings', 'wp-logo-explode')} initialOpen={false}>
					<ToggleControl
						label={__('Use Original Fill', 'wp-logo-explode')}
						help={__('Keep SVG original colors/gradients. Disable to apply custom gradient.', 'wp-logo-explode')}
						checked={useOriginalFill}
						onChange={(value) => setAttributes({ useOriginalFill: value })}
					/>
					{!useOriginalFill && (
						<Fragment>
							<p>{__('Gradient Start Color', 'wp-logo-explode')}</p>
							<ColorPalette
								value={gradientStart}
								onChange={(value) => setAttributes({ gradientStart: value })}
							/>
							<p>{__('Gradient End Color', 'wp-logo-explode')}</p>
							<ColorPalette
								value={gradientEnd}
								onChange={(value) => setAttributes({ gradientEnd: value })}
							/>
							<RangeControl
								label={__('Gradient Angle (deg)', 'wp-logo-explode')}
								value={gradientAngle}
								onChange={(value) => setAttributes({ gradientAngle: value })}
								min={0}
								max={360}
							/>
						</Fragment>
					)}
				</PanelBody>

				<PanelBody title={__('Interaction', 'wp-logo-explode')} initialOpen={false}>
					<ToggleControl
						label={__('Reverse Hover', 'wp-logo-explode')}
						help={__('Start filled, show outline on hover.', 'wp-logo-explode')}
						checked={reverseHover}
						onChange={(value) => setAttributes({ reverseHover: value })}
					/>
					<TextControl
						label={__('Transition ID', 'wp-logo-explode')}
						help={__('Match this ID with other elements for linked transitions.', 'wp-logo-explode')}
						value={transitionId}
						onChange={(value) => setAttributes({ transitionId: value })}
					/>
				</PanelBody>
			</InspectorControls>

			{svgCode ? (
				<div className="explodesvg-editor-wrapper">
					{getPreviewSvg()}
				</div>
			) : (
				<div className="components-placeholder is-large">
					<div className="components-placeholder__label">{__('Explode SVG', 'wp-logo-explode')}</div>
					<div className="components-placeholder__fieldset">
						{__('Paste SVG code in the sidebar settings to get started.', 'wp-logo-explode')}
					</div>
				</div>
			)}
		</div>
	);
}
