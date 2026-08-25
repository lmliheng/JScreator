const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const webpack = require('webpack')
const Dotenv = require('dotenv-webpack')
const dotenv = require('dotenv')


module.exports = (env = {}) => {
    const isProduction = process.env.NODE_ENV === 'production'
    // const isProduction = env.production === true
    // const mode = isProduction ? '.env.production' : '.env.development'
    const envPath = `.env.${process.env.NODE_ENV || 'development'}`

    return {
        mode: isProduction ? 'production' : 'development',
        entry: './src/main.js',

        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
            // 生产部署在站点 /panel/ 子路径下，用绝对路径，
            // 避免访问 /panel（无尾斜杠）时相对资源被解析到站点根目录导致白屏
            publicPath: isProduction ? '/panel/' : '/',
            clean: true
        },

        experiments: {
            topLevelAwait: true
        },

        resolve: {
            extensions: ['.js', '.vue', '.json'],
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },

        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: 'vue-loader'
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    type: 'javascript/auto',  // 关键配置
                    use: [{
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }]
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'font/[name].[hash:8][ext]'
                    }
                }
            ]
        },

        plugins: [
            // 简化：使用默认加载，会自动根据 mode 加载对应文件
            new Dotenv({
                path: `./${envPath}`,
                systemvars: true,  // 包含系统环境变量
                defaults: false     // 加载 .env 不使用默认值
            }),

            new HtmlWebpackPlugin({
                template: 'public/index.html',
                title: isProduction ? '生产环境' : '开发环境'
            }),

            new VueLoaderPlugin(),

            // DefinePlugin 可以简化在代码中使用 process.env 环境变量的定义
            new webpack.DefinePlugin({
                // 定义全局常量
                __VUE_OPTIONS_API__: JSON.stringify(false),   // 启用选项式API支持
                __VUE_PROD_DEVTOOLS__: JSON.stringify(false), // 生产环境禁用DevTools
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false), // 生产环境关闭不匹配详细信息
                NODE_ENV: JSON.stringify(
                    isProduction ? 'production' : 'development'
                )
            })
        ],

        devServer: {
            port: 8085,
            // static: './dist'
            static: './public',
            hot: true,
            open: true,
            liveReload: false,
            client: {
                overlay: false
            },
            // proxy: [
            //     {
            //         context: ['/api'],
            //         target: 'https://api.imooc-admin.lgdsunday.club',
            //         changeOrigin: true,
            //         secure: true
            //     }
            // ]
        },

        // 开发环境优化
        devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
        optimization: {
            minimize: isProduction
        }
    }
}