# Fast-NodeServer

Node.js Express 快速构建的 RESTfulAPI应用

使用commonJS模块化管理，从server.js统一启动

utils下都是工具函数，在test目录下都有测试案例。在utils里的LLM_client目录下都是调用云端模型的，均使用fetch调用(目前不支持OpenAI SDK)。对象存储目录目前有阿里云oss 使用oss SDK。


1. 双token机制

2. 用户私人配置

3. 管理员权限