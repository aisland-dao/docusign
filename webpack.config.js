const path = require('path');

module.exports = {
  entry: './client-src/index.js',
  output: {
    path: path.resolve(__dirname, './html/js'),
    filename: 'bundle.js',
  },
  mode: 'development',
};
