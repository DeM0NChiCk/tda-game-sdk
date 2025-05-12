import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
    // UMD
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/tda-sdk.umd.js',
                format: 'umd',
                name: 'TDAGameAnalyticsSDK',
                sourcemap: true,
            },
            {
                file: 'dist/tda-sdk.umd.min.js',
                format: 'umd',
                name: 'TDAGameAnalyticsSDK',
                plugins: [terser()],
                sourcemap: true,
            }
        ],
        plugins: [resolve(), commonjs()]
    },

    // ESM
    {
        input: 'src/index.js',
        output: {
            file: 'dist/tda-sdk.esm.js',
            format: 'esm',
            sourcemap: true,
        },
        plugins: [resolve(), commonjs()]
    }
];
