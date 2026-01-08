/**
 * Gutenberg Sidebar Extension
 * Adds "Page Transition" controls to blocks.
 */

const { __ } = wp.i18n;
const { createHigherOrderComponent } = wp.compose;
const { Fragment } = wp.element;
const { InspectorControls } = wp.blockEditor;
const { PanelBody, TextControl, SelectControl } = wp.components;
const { addFilter } = wp.hooks;

// Restrict to specific blocks if desired, or allow all with 'core/image' etc.
const ALLOWED_BLOCKS = ['core/image', 'gutenberg-bem/svg-block', 'core/group'];

/**
 * Add attributes to Block registration (Client side)
 * This mirrors the server-side registration
 */
function addAttributes(settings, name) {
    // Optionally check if name is in ALLOWED_BLOCKS
    // For now, let's enable it broadly for flexibility or specific blocks
    if (!ALLOWED_BLOCKS.includes(name)) {
        return settings;
    }

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

        if (!ALLOWED_BLOCKS.includes(name)) {
            return <BlockEdit {...props} />;
        }

        const { transitionId, transitionRole, transitionLink } = attributes;

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
    if (!ALLOWED_BLOCKS.includes(blockType.name)) {
        return extraProps;
    }

    const { transitionId, transitionRole, transitionLink } = attributes;

    if (transitionId && transitionRole) {
        extraProps['data-transition-id'] = transitionId;
        extraProps['data-transition-role'] = transitionRole;

        if (transitionRole === 'source' && transitionLink) {
            extraProps['data-transition-link'] = transitionLink;
        }
    }

    return extraProps;
}
addFilter('blocks.getSaveContent.extraProps', 'wp-logo-explode/add-save-props', addSaveProps);
