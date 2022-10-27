const merge = require('webpack-merge');
const spawn = require('child_process').spawn;

const baseConfig = require('./webpack.renderer.config');

module.exports = merge.merge(baseConfig, {
    resolve: {
        alias: {
            'react-dom': '@hot-loader/react-dom',
        },
    },
    devServer: {
        port: 3000,
        hot: false,
        headers: { 'Access-Control-Allow-Origin': '*' },
        historyApiFallback: {
            verbose: true,
            disableDotRule: false,
        },
        devMiddleware: {
            stats: 'errors-only',
        },
        static: {
            watch: {
                ignored: ['**/node_modules']
            }
        },
        // onBeforeSetupMiddleware() {
        //     if (process.env.START_HOT) {
        //         console.log('Starting main process');
        //         spawn('npm', ['run', 'start-main-dev'], {
        //             shell: true,
        //             env: process.env,
        //             stdio: 'inherit',
        //         })
        //             .on('close', (code) => process.exit(code))
        //             .on('error', (spawnError) => console.error(spawnError));
        //     }
        // },
    },
});
