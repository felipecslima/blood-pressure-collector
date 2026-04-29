const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: path.resolve(__dirname, "app.js"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "assets/app.js",
      clean: true
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, "css-loader"]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
        inject: "body"
      }),
      new MiniCssExtractPlugin({
        filename: "assets/app.css"
      }),
      new CopyPlugin({
        patterns: [
          { from: path.resolve(__dirname, "manifest.webmanifest"), to: "manifest.webmanifest" },
          { from: path.resolve(__dirname, "service-worker.js"), to: "service-worker.js" },
          { from: path.resolve(__dirname, "icon-192.svg"), to: "icon-192.svg" },
          { from: path.resolve(__dirname, "icon-512.svg"), to: "icon-512.svg" }
        ]
      })
    ],
    devServer: {
      static: {
        directory: path.resolve(__dirname, "dist")
      },
      host: "127.0.0.1",
      port: 4173,
      hot: false,
      liveReload: true
    }
  };
};
