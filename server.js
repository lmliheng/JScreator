const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { testConnection } = require('./utils/connect_db');
const cors = require('cors');
const app = express();

// CORS 白名单：只允许自己的前端域名（本地 dev + 云托管前端）
const allowedOrigins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8085',
    'http://localhost:8085',
    'https://prod-3gqvgr0c0ffdcde1-1324237338.tcloudbaseapp.com',
];
app.use(cors({
    origin(origin, callback) {
        // 无 origin（同源/非浏览器/curl 等）直接放行
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // 不允许的来源：不返回 CORS 头，浏览器端会拦截响应（不产生 500）
        return callback(null, false);
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 接口调用统计中间件（挂在所有路由之前）
const { recordApi } = require('./utils/api_monitor');
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        recordApi(req, res, Date.now() - start);
    });
    next();
});

app.use(require('./routes/login_request'))
app.use(require('./routes/register_request'))
app.use(require('./routes/article_request'))
app.use(require('./routes/article_category_request'))
app.use(require('./routes/blog_profile_request'))
app.use(require('./routes/comment_request'))
app.use(require('./routes/user_request'))
// app.use(require('./routes/hunyuan_request'))
app.use(require('./routes/role_request'))
app.use(require('./routes/permission_request'))
app.use(require('./routes/notification_request'))
app.use(require('./routes/system_monitor_request'))
app.use(require('./routes/init_request'))
app.use(require('./routes/auth_github'))
app.use(require('./routes/auth_email'))
app.use(require('./routes/upload_request'))
app.use(require('./routes/social_request'))
app.use(require('./routes/ad_request'))
app.use(require('./routes/announcement_request'))

// 路由全部挂载后，登记全部接口清单（系统监控的接口统计显示所有接口，未调用的为 0 次）
const { registerRoutes } = require('./utils/api_monitor');
registerRoutes(app);


async function startServer() {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
  });
}

startServer();
