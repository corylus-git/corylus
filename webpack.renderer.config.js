const path = require('path');

const webpack = require('webpack');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const baseConfig = require('./webpack.base.config');

const APP_DIR = path.resolve(__dirname, './src');
const MONACO_DIR = path.resolve(__dirname, './node_modules/monaco-editor');

/*
plugins: [
    [
    require.resolve('babel-plugin-named-asset-import'),
    {
        loaderMap: {
        svg: {
            ReactComponent:
            '@svgr/webpack?-svgo,+titleProp,+ref![path]',
        },
        },
    },
    ],
],
*/

module.exports = merge.smart(baseConfig, {
    target: 'electron-renderer',
    entry: {
        app: ['@babel/polyfill', './src/renderer/app.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                loader: 'ts-loader',
            },
            {
                test: /\.scss$/,
                loaders: ['style-loader', 'css-loader'],
            },
            {
                test: /\.css$/,
                exclude: MONACO_DIR,
                use: [
                    { loader: 'style-loader' },
                    {
                        loader: 'css-loader',
                    },
                ],
            },
            {
                test: /\.css$/,
                include: MONACO_DIR,
                loaders: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(gif|png|jpe?g)$/,
                use: [
                    'file-loader',
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            disable: true,
                        },
                    },
                ],
            },
            {
                test: /\.(woff2?|ttf)$/,
                loaders: ['file-loader'],
            },
            {
                // turn all SVGs into components to be able to theme them later
                test: /\.svg$/,
                use: [
                    {
                        loader: '@svgr/webpack',
                        options: {
                            // typescript: true,
                            // ext: 'tsx'
                        },
                    },
                ],
            },
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            {
                enforce: 'pre',
                test: /\.js$/,
                loader: 'source-map-loader',
            },
        ],
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            reportFiles: ['src/renderer/**/*'],
        }),
        new webpack.NamedModulesPlugin(),
        new HtmlWebpackPlugin({
            title: 'Corylus',
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        }),
        new MonacoWebpackPlugin(),
    ],
});
