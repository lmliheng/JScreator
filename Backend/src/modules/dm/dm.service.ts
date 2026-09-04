/**
 * modules/dm/dm.service —— 私信 REST 业务（会话/历史/未读/已读）。
 */
import { dmDao } from './dm.dao.js';

export class DmService {
    constructor(private readonly dao = dmDao) {}

    conversations(userId: number | string) {
        return this.dao.conversationList(userId);
    }

    messages(userId: number | string, otherId: number, page: unknown, pageSize: unknown) {
        return this.dao.conversation(userId, otherId, page, pageSize);
    }

    unreadCount(userId: number | string): Promise<number> {
        return this.dao.unreadTotal(userId);
    }

    markRead(userId: number | string, otherId: number): Promise<void> {
        return this.dao.markRead(userId, otherId);
    }

    /** WS 实时发消息（复用 REST 侧 dao；msgSend 语义） */
    send(userId: number | string, otherId: number | string, content: string): Promise<number | string> {
        return this.dao.send(userId, otherId, content);
    }
}
