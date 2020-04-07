const path = require('path');
const {BannerPlugin} = require("webpack");
const default_config =
  require('fs').readFileSync(path.join(__dirname, './src/default_config.js')).toString();

const banner_plugin = new BannerPlugin({
  banner: default_config,
  raw: true,
  entryOnly: true
});

module.exports = {
  entry: {
    bundle: path.join(__dirname, './src/main.js'),
  },

  output: {
    filename: 'worker.js',
    path: path.join(__dirname),
  },

  plugins: [banner_plugin],

  mode: process.env.NODE_ENV || 'development',

  watchOptions: {
    ignored: /node_modules|dist|\.js/g,
  },

  // devtool: 'cheap-module-eval-source-map',

  resolve: {
    extensions: ['.js', '.json'],
    plugins: [],
  },

  module: {
    rules: []
  },
}