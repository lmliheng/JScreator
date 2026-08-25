const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { testConnection } = require('./utils/connect_db');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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


async function startServer() {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
  });
}

startServer();
