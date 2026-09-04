/**
 * modules/user/user.service —— 用户域业务（/sys/profile、/userInfo、/resetPassword、/user-manage/*）。
 * 对齐 legacy routes/user_request.js 的分支语义；哈希用注入的 ToHash（crypto_password 桥）。
 */
import type { UserId } from './user.dao.js';

export interface ProfileResult {
    user_detail: Record<string, unknown>;
    user_permission: Array<{ permission_name: unknown; permission_id: unknown }>;
}

export type ProfileOutcome = ProfileResult | null; // null = 找不到用户信息（对应 legacy 401 分支）

export interface UserDeps {
    profileRows: (userId: UserId) => Promise<Array<Record<string, unknown>>>;
    getUserStats: (userId: UserId) => Promise<{ article_count: number; comment_count: number }>;
    setPasswordHash: (id: UserId, hash: string) => Promise<void>;
    updateProfile: (id: UserId, fields: Record<string, unknown>) => Promise<boolean>;
    clearGithubId: (id: UserId) => Promise<void>;
    listPage: (
        page: number,
        pageSize: number,
        keyword: string
    ) => Promise<{ list: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>;
    addUser: (username: string, email: string, hash: string, roleId?: unknown) => Promise<number | string>;
    deleteById: (id: UserId) => Promise<void>;
    deleteBatchByIds: (ids: Array<number | string>) => Promise<number>;
    getDetailById: (id: UserId) => Promise<Record<string, unknown> | null>;
    existsByEmail: (email: string) => Promise<boolean>;
    existsByUsername: (username: string) => Promise<boolean>;
    getRoleId: (id: UserId) => Promise<number | null>;
    ToHash: (password: string) => string;
}

export class UserService {
    constructor(private readonly d: UserDeps) {}

    /** /sys/profile：userId 来自已解析 token */
    async profile(userId: UserId): Promise<ProfileOutcome> {
        const rows = await this.d.profileRows(userId);
        if (!Array.isArray(rows) || rows.length === 0) {
            return null;
        }
        const user_permission = rows.map((item) => ({
            permission_name: item.permission_name,
            permission_id: item.permission_id,
        }));
        const first: Record<string, unknown> = { ...rows[0] };
        delete first.permission_name;
        delete first.permission_id;
        try {
            const stats = await this.d.getUserStats(first.id as UserId);
            first.article_count = stats.article_count;
            first.comment_count = stats.comment_count;
        } catch {
            first.article_count = 0;
            first.comment_count = 0;
        }
        return { user_detail: first, user_permission };
    }

    /** actor 是否可编辑 target：本人或管理员 */
    async canEditTarget(targetId: UserId, actorId: UserId): Promise<boolean> {
        if (Number(targetId) === Number(actorId)) return true;
        const role = await this.d.getRoleId(actorId);
        return Number(role) === 1;
    }

    /** 本人更新资料：legacy 不关心是否无字段可更新（照常 200） */
    async updateSelfProfile(id: UserId, fields: Record<string, unknown>): Promise<void> {
        await this.d.updateProfile(id, fields);
    }

    /** 管理员更新：返回 false 表示无字段可更新（对应 legacy 400 分支） */
    async updateByAdmin(id: UserId, fields: Record<string, unknown>): Promise<boolean> {
        return this.d.updateProfile(id, fields);
    }

    async unbindGithub(userId: UserId): Promise<void> {
        await this.d.clearGithubId(userId);
    }

    async resetMyPassword(userId: UserId, password: string): Promise<void> {
        await this.d.setPasswordHash(userId, this.d.ToHash(password));
    }

    async adminResetPassword(id: UserId, password: string): Promise<void> {
        await this.d.setPasswordHash(id, this.d.ToHash(password));
    }

    async list(page: number, pageSize: number, keyword: string) {
        return this.d.listPage(page, pageSize, keyword);
    }

    async detail(id: UserId): Promise<Record<string, unknown> | null> {
        return this.d.getDetailById(id);
    }

    async add(input: { username: string; email: string; password: string; roleId?: unknown }): Promise<
        { ok: true; id: number | string } | { ok: false; message: string }
    > {
        if (await this.d.existsByEmail(input.email)) {
            return { ok: false, message: '邮箱已存在' };
        }
        if (await this.d.existsByUsername(input.username)) {
            return { ok: false, message: '用户名已存在' };
        }
        const hash = this.d.ToHash(input.password);
        const id = await this.d.addUser(input.username, input.email, hash, input.roleId);
        return { ok: true, id };
    }

    async remove(id: UserId): Promise<void> {
        await this.d.deleteById(id);
    }

    /** 批量删除（filteredIds 已排除操作者本人） */
    async removeBatch(filteredIds: Array<number | string>): Promise<number> {
        return this.d.deleteBatchByIds(filteredIds);
    }
}
