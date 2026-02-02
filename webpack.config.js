const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    ...defaultConfig,
    entry: {
        index: './src/index.js',
        'blocks/explodesvg/index': './src/explodesvg/index.js',
    },
    plugins: [
        ...(defaultConfig.plugins || []),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'src/explodesvg/block.json'),
                    to: path.resolve(__dirname, 'build/blocks/explodesvg/block.json'),
                },
                {
                    from: path.resolve(__dirname, 'build/style-index.css'),
                    to: path.resolve(__dirname, 'build/blocks/explodesvg/style-index.css'),
                },
            ],
        }),
    ],
};
