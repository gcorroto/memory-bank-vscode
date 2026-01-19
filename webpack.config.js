//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
    '@lancedb/lancedb': 'commonjs @lancedb/lancedb', // LanceDB has native modules that can't be bundled
    'sql.js': 'commonjs sql.js', // sql.js must be loaded at runtime to properly handle WASM
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
        { from: 'node_modules/sql.js/dist/sql-wasm.js', to: 'node_modules/sql.js/dist/sql-wasm.js' },
      ],
    }),
  ],
  resolve: {
    // support reading TypeScript and JavaScript files
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};

/**@type {import('webpack').Configuration}*/
const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: {
    'logs-webview': './src/agent/ui/react-logs/index.tsx',
    'flow-webview': './src/agent/ui/react-flow/index.tsx',
    'config-webview': './src/agent/ui/react-config/index.tsx',
    'dashboard': './src/agent/ui/react-agent-dashboard/index.tsx',
    'relations-webview': './src/agent/ui/react-relations/index.tsx'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'window'
  },
  performance: {
    hints: false, // Disable size warnings for webviews (React Flow is large but acceptable)
    maxAssetSize: 512000,
    maxEntrypointSize: 512000
  },
  devtool: 'nosources-source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.css']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'esnext'
              }
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process': JSON.stringify({})
    })
  ]
};

module.exports = [extensionConfig, webviewConfig]; 