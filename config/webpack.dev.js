const path = require('path')
const webpack = require('webpack')
const glob = require('glob')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

/**
 * 多页面应用(MPA)概念：每一次页面跳转的时候，后台服务器都会返回一个新的HTML文档。这种类型的
 * 网站就是多页网站，也叫多页应用。
 *
 * 多页面打包通用方案：动态获取entry和设置html-webpack-plugin数量。
 * 约定：将入口文件都设置成index.js，模板文件设置成index.html
 */
const setMPA = () => {
  const entry = {}
  const htmlWebpackPlugins = []

  // 以同步的方式把文件查询出来。
  const entryFiles = glob.sync(path.join(__dirname, '../src/*/index.js*'))

  Object.keys(entryFiles).map(index => {
    const entryFile = entryFiles[index]
    const match = entryFile.match(/src\/(.*)\/index\.js/)
    const pageName = match && match[1]

    entry[pageName] = entryFile

    htmlWebpackPlugins.push(
      new HtmlWebpackPlugin({
        template: path.join(__dirname, `../src/${pageName}/index.html`), // HTML模板文件所在位置
        filename: `${pageName}.html`, // 打包出来的HTML文件名称
        chunks: [pageName], // 指定生成的HTML要使用哪些chunk
        inject: true, // 打包的chunk，像JS、CSS会自动注入HTML中
        // 压缩HTML
        minify: {
          html5: true,
          collapseWhitespace: true, // 移除空格
          preserveLineBreaks: false,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true // 移除注释
        }
      })
    )
  })

  return {
    entry,
    htmlWebpackPlugins
  }
}

const { entry, htmlWebpackPlugins } = setMPA()

module.exports = {
  /**
   * 文件监听的原理分析:
   *
   * 轮询判断文件的最后编辑时间是否变化。某个文件发生了变化，并不会立刻告诉监听者，而是先缓存起来，等aggregateTimeout。
   */
  // watch: true, //另外一种方式：启动webpack命令，带上 --watch 参数

  // 只有开启监听模式时，watchOptions才有意义
  watchOptions: {
    // 默认为空，不监听的文件或者文件夹，支持正则匹配。忽视node_modules会提升文件监听性能。
    ignored: /node_modules/,
    // 监听到变化发生后会等300ms再去执行，默认300ms
    aggregateTimeout: 300,
    // 判断文件是否发生变化是通过不停询问系统指定文件有没有变化实现的，默认每秒问1000次
    poll: 1000
  },
  entry,
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js' // 通过占位符确保文件名称的唯一
  },
  /**
   * Mode 用于指定当前的构建环境是：production、development还是none。
   *
   * 设置 mode 可以使用webpack内置的函数，默认值是production。
   */
  mode: 'development',
  /**
   * webpack 开箱即用只支持JS和JSON两种文件类型，通过Loaders去支持其他文件类型并且把它们转化为有效的模块，并且添加到依赖图中。
   *
   * Loaders本身是一个函数，接收源文件作为参数，返回转换的结果。
   */
  module: {
    /**
     * test 指定匹配规则
     * use 指定使用的loader名称
     */
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: '/node_modules/'
      },
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader' // 解析ES6，配置文件
      },
      {
        test: /\.css$/,
        /**
         * 注意：loader调用是链式调用，执行顺序是从右到左。
         */
        use: [
          'style-loader', // 将样式通过<style>标签插入到head中
          'css-loader' // 用于加载.css文件，并且转换成commonJS对象
        ]
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          'less-loader' // 用于将less转换成css。less-loader依赖于less，所以需安装下less。
        ]
      },
      /**
       * url-loader也可以处理图片和字体。可以设置较小资源自动转base64，从而减少网络请求。
       */
      {
        test: /\.(png|jpg|gif|jpeg)$/,
        use: [
          {
            loader: 'url-loader',
            /**
             * 注意图片、字体的hash是指文件内容的hash，与之前提到的CSS的contentHash类似。
             */
            options: {
              limit: 10240, // 10K大小。如果资源小于10K大小，webpack打包的时候会自动对它进行base64编码。
              name: '[name]_[hash:8].[ext]' // ext：资源后缀名
            }
          }
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name]_[hash:8].[ext]' // ext：资源后缀名
            }
          }
        ] //用于处理文件，也可以处理字体
      }
    ]
  },
  resolve: {
    // 自动解析确认的扩展
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, '../src/')
    }
  },
  /**
   * 插件用于 bundle 文件的优化，资源管理和环境变量注入。
   *
   * Plugins作用于整个构建过程。
   */
  plugins: [
    // 启用热替换模块(Hot Module Replacement)，配合webpack-dev-server一起使用
    new webpack.HotModuleReplacementPlugin(),

    /**
     * 每次构建的时候不会清理目录，造成构建的输出目录output文件越来越多
     *
     * + rm -rf ./dist && webpack --- 不够优雅
     * + clean-webpack-plugin: 默认会删除output指定的输出目录，避免手动删除dist
     */
    new CleanWebpackPlugin()
  ].concat(htmlWebpackPlugins),
  /**
   * webpack-dev-server
   *
   * WDS 不刷新浏览器
   * WDS 不输出文件，而是放在内存中
   */
  devServer: {
    contentBase: './dist', // webpack-dev-server服务的基础目录
    hot: true
  },
  /**
   * source-map
   *
   * 作用：通过source-map定位到源代码。通常开发环境开启，线上环境关闭。若线上
   * 需排查问题，可以将sourcemap上传到错误监控系统。
   *
   * 关键字：
   * + eval: 使用eval包裹模块代码；
   * + source map: 产生.map文件；
   * + cheap: 不包含列信息；
   * + inline: 将.map作为DataURI嵌入，不单独生成.map文件(打包时会将sourcemap和js文件打包在一起)；
   * + module: 包含loader的sourcemap；
   */
  devtool: 'source-map'
}
