const path = require("path");
const webpack = require("webpack");

module.exports = {
  target: "node",
  entry: {
    vender: ["./js/pixi.min.js", "./js/main.js"],
  }, // 入口, 可以为相对路径, 当然绝对路径也没错
  output: {
    // 输出配置
    path: path.join(__dirname, "../"), // 输出的目录
    filename: "initLive2D_3.js", // 输出的文件名
  },
  mode: "development", // 打包的模式, production | development

  plugins: [
    new webpack.ProvidePlugin({
      $: "jquery",
    }),
  ],
};
