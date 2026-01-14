/**
 * Gutenberg Sidebar Extension
 * Adds "Page Transition" controls to blocks.
 */

const { __ } = wp.i18n;
const { createHigherOrderComponent } = wp.compose;
const { Fragment, useState } = wp.element;
const { InspectorControls } = wp.blockEditor;
const { PanelBody, TextControl, SelectControl, ColorPalette, RangeControl, Button, Modal } = wp.components;
const { addFilter } = wp.hooks;

/**
 * Add attributes to Block registration (Client side)
 * This mirrors the server-side registration
 */
function addAttributes(settings, name) {
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
            // NEW: Animate selector for nested element
            transitionAnimateSelector: {
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
            // NEW: SEO link attributes
            linkAriaLabel: {
                type: 'string',
                default: '',
            },
            linkTitle: {
                type: 'string',
                default: '',
            },
            linkRel: {
                type: 'string',
                default: '',
            },
        });
    }
    return settings;
}
addFilter('blocks.registerBlockType', 'wp-logo-explode/add-attributes', addAttributes);

/**
 * SEO Settings Modal Component
 */
function SEOSettingsModal({ attributes, setAttributes, onClose }) {
    const { linkAriaLabel, linkTitle, linkRel } = attributes;

    return (
        <Modal
            title={__('SEO Link Settings', 'wp-logo-explode')}
            onRequestClose={onClose}
            className="wp-logo-explode-seo-modal"
        >
            <div style={{ minWidth: '400px' }}>
                <TextControl
                    label={__('Aria Label', 'wp-logo-explode')}
                    help={__('Accessible label for screen readers (e.g., "Learn more about our services")', 'wp-logo-explode')}
                    value={linkAriaLabel}
                    onChange={(value) => setAttributes({ linkAriaLabel: value })}
                />
                <TextControl
                    label={__('Link Title', 'wp-logo-explode')}
                    help={__('Tooltip text shown on hover', 'wp-logo-explode')}
                    value={linkTitle}
                    onChange={(value) => setAttributes({ linkTitle: value })}
                />
                <TextControl
                    label={__('Link Rel Attribute', 'wp-logo-explode')}
                    help={__('Relationship attributes (e.g., "nofollow", "sponsored", "noopener")', 'wp-logo-explode')}
                    value={linkRel}
                    onChange={(value) => setAttributes({ linkRel: value })}
                    placeholder="nofollow noopener"
                />
                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <Button variant="primary" onClick={onClose}>
                        {__('Done', 'wp-logo-explode')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * Add Inspector Controls (UI)
 */
const withInspectorControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { name, attributes, setAttributes } = props;
        const [isSEOModalOpen, setIsSEOModalOpen] = useState(false);

        const {
            transitionId,
            transitionRole,
            transitionLink,
            transitionColor,
            transitionAnimateSelector,
            offsetX,
            offsetY,
            durationExpand,
            durationShrink,
            scaleExplode,
            linkAriaLabel,
            linkTitle,
            linkRel
        } = attributes;

        // Check if any SEO fields are set
        const hasSEOSettings = linkAriaLabel || linkTitle || linkRel;

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
                            <Fragment>
                                <TextControl
                                    label={__('Link URL', 'wp-logo-explode')}
                                    help={__('Where this block should link to.', 'wp-logo-explode')}
                                    value={transitionLink}
                                    onChange={(value) => setAttributes({ transitionLink: value })}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsSEOModalOpen(true)}
                                    style={{ marginBottom: '16px' }}
                                >
                                    {__('SEO Settings', 'wp-logo-explode')}
                                    {hasSEOSettings && ' ✓'}
                                </Button>
                                {isSEOModalOpen && (
                                    <SEOSettingsModal
                                        attributes={attributes}
                                        setAttributes={setAttributes}
                                        onClose={() => setIsSEOModalOpen(false)}
                                    />
                                )}
                            </Fragment>
                        )}

                        <TextControl
                            label={__('Animate Selector', 'wp-logo-explode')}
                            help={__('CSS selector for nested element to animate (e.g., ".my-logo", "#logo-svg"). Leave empty to animate the whole block.', 'wp-logo-explode')}
                            value={transitionAnimateSelector}
                            onChange={(value) => setAttributes({ transitionAnimateSelector: value })}
                            placeholder=".my-nested-svg"
                        />

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
 * For dynamic blocks (Kadence, etc.), this won't run - PHP handles it.
 */
function addSaveProps(extraProps, blockType, attributes) {
    const {
        transitionId,
        transitionRole,
        transitionLink,
        transitionColor,
        transitionAnimateSelector,
        offsetX,
        offsetY,
        durationExpand,
        durationShrink,
        scaleExplode,
        linkAriaLabel,
        linkTitle,
        linkRel
    } = attributes;

    if (transitionId && transitionRole) {
        extraProps['data-transition-id'] = transitionId;
        extraProps['data-transition-role'] = transitionRole;

        if (transitionRole === 'source' && transitionLink) {
            extraProps['data-transition-link'] = transitionLink;
        }

        if (transitionColor) extraProps['data-transition-color'] = transitionColor;
        if (transitionAnimateSelector) extraProps['data-transition-animate-selector'] = transitionAnimateSelector;
        if (durationExpand) extraProps['data-transition-duration-expand'] = durationExpand;
        if (durationShrink) extraProps['data-transition-duration-shrink'] = durationShrink;
        if (scaleExplode) extraProps['data-transition-scale-explode'] = scaleExplode;

        if (transitionRole === 'target') {
            if (offsetX) extraProps['data-transition-offset-x'] = offsetX;
            if (offsetY) extraProps['data-transition-offset-y'] = offsetY;
        }

        // SEO attributes are handled server-side via fallback link injection
    }

    return extraProps;
}
addFilter('blocks.getSaveContent.extraProps', 'wp-logo-explode/add-save-props', addSaveProps);

