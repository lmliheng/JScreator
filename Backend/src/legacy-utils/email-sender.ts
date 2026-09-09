/**
 * legacy-utils/email-sender —— 邮件发送
 * 迁移自 root utils/emailSender.js。
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export const EmailTransporter: Transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendMail(
    transport: Transporter,
    to: string,
    subject: string,
    html: string
): Promise<unknown> {
    try {
        const info = await transport.sendMail({
            from: process.env.FROM_EMAIL,
            to,
            subject,
            text: '请使用支持 HTML 的客户端查看',
            html,
        });
        return info;
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

export async function sendVerificationCode(to: string, code: string): Promise<unknown> {
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