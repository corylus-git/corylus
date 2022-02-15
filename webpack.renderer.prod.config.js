const merge = require('webpack-merge');

const baseConfig = require('./webpack.renderer.config');

module.exports = merge.merge(baseConfig, {
    mode: 'production'
});
