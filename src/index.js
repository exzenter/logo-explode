/**
 * Gutenberg Sidebar Extension
 * Adds "Page Transition" controls to blocks.
 */

const { __ } = wp.i18n;
const { createHigherOrderComponent } = wp.compose;
const { Fragment } = wp.element;
const { InspectorControls } = wp.blockEditor;
const { PanelBody, TextControl, SelectControl, ColorPalette, RangeControl } = wp.components;
const { addFilter } = wp.hooks;

// Restrict to specific blocks if desired, or allow all with 'core/image' etc.
// Allowed blocks restriction removed to support all blocks (including SVG block)
// const ALLOWED_BLOCKS = ['core/image', 'gutenberg-bem/svg-block', 'core/group'];


/**
 * Add attributes to Block registration (Client side)
 * This mirrors the server-side registration
 */
function addAttributes(settings, name) {
    // Optionally check if name is in ALLOWED_BLOCKS
    // For now, let's enable it broadly for flexibility or specific blocks
    // Restriction removed
    // if (!ALLOWED_BLOCKS.includes(name)) {
    //    return settings;
    // }

    if (typeof settings.attributes !== 'undefined') {
        settings.attributes = Object.assign(settings.attributes, {
            transitionId: {
                type: 'string',
                default: '',
            },
            transitionRole: {
                type: 'string',
                default: '',
            },
            transitionLink: {
                type: 'string',
                default: '',
            },
            transitionColor: {
                type: 'string',
                default: '',
            },
            offsetX: {
                type: 'number',
                default: 0,
            },
            offsetY: {
                type: 'number',
                default: 0,
            },
            durationExpand: {
                type: 'number',
                default: 0,
            },
            durationShrink: {
                type: 'number',
                default: 0,
            },
            scaleExplode: {
                type: 'number',
                default: 0,
            },
        });
    }
    return settings;
}
addFilter('blocks.registerBlockType', 'wp-logo-explode/add-attributes', addAttributes);

/**
 * Add Inspector Controls (UI)
 */
const withInspectorControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { name, attributes, setAttributes } = props;

        // Restriction removed
        // if (!ALLOWED_BLOCKS.includes(name)) {
        //    return <BlockEdit {...props} />;
        // }

        const { transitionId, transitionRole, transitionLink, transitionColor, offsetX, offsetY, durationExpand, durationShrink, scaleExplode } = attributes;

        return (
            <Fragment>
                <BlockEdit {...props} />
                <InspectorControls>
                    <PanelBody title={__('Page Transition Effect', 'wp-logo-explode')} initialOpen={false}>
                        <TextControl
                            label={__('Transition ID', 'wp-logo-explode')}
                            help={__('Unique ID linking the start and end logos (e.g. "my-logo").', 'wp-logo-explode')}
                            value={transitionId}
                            onChange={(value) => setAttributes({ transitionId: value })}
                        />
                        <SelectControl
                            label={__('Role', 'wp-logo-explode')}
                            value={transitionRole}
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Source (Start Page)', value: 'source' },
                                { label: 'Target (End Page)', value: 'target' },
                            ]}
                            onChange={(value) => setAttributes({ transitionRole: value })}
                        />
                        {transitionRole === 'source' && (
                            <TextControl
                                label={__('Link URL', 'wp-logo-explode')}
                                help={__('Where this logo should link to.', 'wp-logo-explode')}
                                value={transitionLink}
                                onChange={(value) => setAttributes({ transitionLink: value })}
                            />
                        )}

                        <Fragment>
                            <p style={{ marginTop: '10px', marginBottom: '5px' }}>{__('Transition Color', 'wp-logo-explode')}</p>
                            <ColorPalette
                                value={transitionColor}
                                onChange={(value) => setAttributes({ transitionColor: value })}
                            />

                            <RangeControl
                                label={__('Expansion Duration (ms)', 'wp-logo-explode')}
                                value={durationExpand || 0}
                                onChange={(value) => setAttributes({ durationExpand: value })}
                                min={0}
                                max={3000}
                                help={__('0 = Use Global Default', 'wp-logo-explode')}
                            />

                            <RangeControl
                                label={__('Shrink Duration (ms)', 'wp-logo-explode')}
                                value={durationShrink || 0}
                                onChange={(value) => setAttributes({ durationShrink: value })}
                                min={0}
                                max={3000}
                                help={__('0 = Use Global Default', 'wp-logo-explode')}
                            />

                            <RangeControl
                                label={__('Explosion Scale', 'wp-logo-explode')}
                                value={scaleExplode || 0}
                                onChange={(value) => setAttributes({ scaleExplode: value })}
                                min={0}
                                max={200}
                                help={__('0 = Use Global Default', 'wp-logo-explode')}
                            />

                            {transitionRole === 'target' && (
                                <Fragment>
                                    <hr />
                                    <p style={{ fontWeight: 'bold' }}>{__('Position Offsets', 'wp-logo-explode')}</p>
                                    <RangeControl
                                        label={__('X Offset (px)', 'wp-logo-explode')}
                                        value={offsetX}
                                        onChange={(value) => setAttributes({ offsetX: value })}
                                        min={-500}
                                        max={500}
                                    />
                                    <RangeControl
                                        label={__('Y Offset (px)', 'wp-logo-explode')}
                                        value={offsetY}
                                        onChange={(value) => setAttributes({ offsetY: value })}
                                        min={-500}
                                        max={500}
                                    />
                                </Fragment>
                            )}
                        </Fragment>
                    </PanelBody>
                </InspectorControls>
            </Fragment>
        );
    };
}, 'withInspectorControls');
addFilter('editor.BlockEdit', 'wp-logo-explode/with-inspector-controls', withInspectorControls);

/**
 * Add data attributes to the wrapper in Editor & Frontend
 * Note: getSaveContent.extraProps applies to the FRONTEND save output.
 */
function addSaveProps(extraProps, blockType, attributes) {
    // Restriction removed
    // if (!ALLOWED_BLOCKS.includes(blockType.name)) {
    //    return extraProps;
    // }

    const { transitionId, transitionRole, transitionLink, transitionColor, offsetX, offsetY, durationExpand, durationShrink, scaleExplode } = attributes;

    if (transitionId && transitionRole) {
        extraProps['data-transition-id'] = transitionId;
        extraProps['data-transition-role'] = transitionRole;

        if (transitionRole === 'source' && transitionLink) {
            extraProps['data-transition-link'] = transitionLink;
        }

        if (transitionColor) extraProps['data-transition-color'] = transitionColor;
        if (durationExpand) extraProps['data-transition-duration-expand'] = durationExpand;
        if (durationShrink) extraProps['data-transition-duration-shrink'] = durationShrink;
        if (scaleExplode) extraProps['data-transition-scale-explode'] = scaleExplode;

        if (transitionRole === 'target') {
            if (offsetX) extraProps['data-transition-offset-x'] = offsetX;
            if (offsetY) extraProps['data-transition-offset-y'] = offsetY;
        }
    }

    return extraProps;
}
addFilter('blocks.getSaveContent.extraProps', 'wp-logo-explode/add-save-props', addSaveProps);
