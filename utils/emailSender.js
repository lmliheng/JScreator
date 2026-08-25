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




/**
 * @验证码发送
 */
async function sendVerificationCode(to, code) {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">JScreator 登录验证码</h2>
            <p style="font-size: 16px;">你的验证码是：</p>
            <p style="font-size: 28px; font-weight: bold; color: #409eff; letter-spacing: 4px;">${code}</p>
            <p style="color: #999; font-size: 13px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
        </div>
    `;
    return sendMail(EmailTransporter, to, '【JScreator】登录验证码', html);
}

module.exports = {
    EmailTransporter,
    sendMail,
    sendVerificationCode
}