const nodemailer = require('nodemailer')
/***
 * @邮箱发送工具
 */
const EmailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * @邮箱发送
 * 
 * 需要补充：附件，...
 * 
 */
async function sendMail(transport, to, subject, html) {
    try {
        const info = await transport.sendMail({
            from: process.env.FROM_EMAIL,
            to,  // 多个用逗号 'a@x.com,b@y.com'
            subject, // 主题
            text: '请使用支持 HTML 的客户端查看', // 兜底
            html, // 
        });

        return info;
    } catch (error) {
        console.error(error)
    }
}

/**
 * @验证码发送
 */




module.exports = {
    EmailTransporter,
    sendMail
}