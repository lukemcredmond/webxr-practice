const path = require('path')

module.exports = {
    entry: {
        bundle:'./src/client/client.ts',
        ar:'./src/client/ar.ts',
        vr:'./src/client/vr.ts'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '../../'),
    },
}