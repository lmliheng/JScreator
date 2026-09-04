/**
 * db/transaction —— 跨 DAO/多语句写操作的事务助手。
 * 用法：dao 方法接受可选 conn（由 service 层 withTransaction 传入），未传入时用默认池连接。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbConnection = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoolLike = { getConnection: () => Promise<DbConnection> };

/**
 * 在独立连接上执行 fn：begin → fn(conn) → commit；异常 rollback 后抛出；finally release。
 * P4：文章+分类、文章删除（级联）、评论级联删除、OAuth 授权码消费等场景使用。
 */
export async function withTransaction<T>(pool: PoolLike, fn: (conn: DbConnection) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const conn = await pool.getConnection();
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await conn.beginTransaction();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await fn(conn);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await conn.commit();
        return result;
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await conn.rollback().catch(() => {});
        throw error;
    } finally {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await conn.release().catch(() => {});
    }
}
