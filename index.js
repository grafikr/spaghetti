const fs = require('fs')
const path = require('path')
const exit = require('exit')
const c = require('ansi-colors')
const webpack = require('webpack')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const { log, resolve, join } = require('./util.js')

/**
 * TODO
 */
const userPostcssConfig = fs.existsSync(resolve('postcss.config.js'))
const userBabelConfig = fs.existsSync(resolve('.babelrc'))

module.exports = (config = {}) => {
  const compiler = webpack({
    mode: config.watch ? 'production' : 'development',
    target: 'web',
    performance: { hints: false },
    devtool: 'cheap-module-source-map',
    entry: resolve(config.in),
    output: {
      path: config.outDir,
      filename: config.filename + '.js'
    },
    module: {
      rules: [
        Object.assign(
          {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: require.resolve('babel-loader')
          },
          userBabelConfig ? {} : {
            options: {
              babelrc: false,
              plugins: [
                require.resolve('babel-plugin-lodash'),
                require.resolve('@babel/plugin-syntax-object-rest-spread'),
                require.resolve('@babel/plugin-proposal-class-properties')
              ],
              presets: [
                [require.resolve('@babel/preset-env'), {
                  targets: {
                    ie: '11'
                  }
                }],
                require.resolve('@babel/preset-react')
              ]
            }
          }
        ),
        {
          test: /\.css$/,
          exclude: /node_modules/,
          use: ExtractTextPlugin.extract([
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                plugins: [
                  require('postcss-import'),
                  require('postcss-nested'),
                  require('postcss-cssnext')({
                    warnForDuplicates: false
                  }),
                  require('postcss-discard-comments'),
                  !config.watch && require('cssnano')
                ].filter(Boolean)
              }
            }
          ])
        }
      ].filter(Boolean)
    },
    resolve: {
      alias: Object.keys(config.alias).reduce((alias, k) => {
        alias[k] = resolve(config.alias[k])
        return alias
      }, {})
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      new ExtractTextPlugin((config.filename + '.css'))
    ].filter(Boolean)
  })

  function emit(fns, data) {
    fns && fns.map(f => f(data))
  }

  function methods (bundle) {
    let fns = {
      error: [
        e => log(c.red('compilation'), e)
      ]
    }

    emit(fns.start)

    bundle((err, stats) => {
      if (err || stats.hasErrors()) {
        return emit(fns.error, err || stats.compilation.errors)
      }

      emit(fns.end, {
        stats,
        duration: stats.endTime - stats.startTime
      })
    })

    return {
      start (cb) {
        fns.start = (fns.start || []).concat(cb)
        return this
      },
      end (cb) {
        fns.end = (fns.end || []).concat(cb)
        return this
      },
      error (cb) {
        fns.error = (fns.error || []).concat(cb)
        return this
      }
    }
  }

  return {
    build () {
      return methods(done => compiler.run(done))
    },
    watch () {
      return methods(done => compiler.watch({}, done))
    }
  }
}