const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = {
  entry: './client-src/index.js',
  output: {
    path: path.resolve(__dirname, './html/js'),
    filename: 'bundle.js',
  },
  mode: 'development',
  plugins: [new NodePolyfillPlugin()]
}; 

