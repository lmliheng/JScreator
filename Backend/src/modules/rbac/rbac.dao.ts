/**
 * modules/rbac/rbac.dao —— role / permission / roleandpermission_middle 参数化 SQL。
 * 来源：utils/db_curd.js 角色权限函数，逐行搬运（setPermission 保持事务）。
 */
import { pool } from '../../db/pool.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export class RbacDao {
    async roleGetAll(): Promise<Array<AnyRow>> {
        const [rows] = await pool.query('SELECT * FROM role');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async roleAdd(roleName: string): Promise<void> {
        await pool.query('INSERT INTO role (role_name) VALUES (?)', [roleName]);
    }

    async roleDelete(roleId: number | string): Promise<void> {
        await pool.query('DELETE FROM role WHERE role_id = ?', [roleId]);
    }

    async roleUpdateName(roleId: number | string, roleName: string): Promise<void> {
        await pool.query('UPDATE role SET role_name = ? WHERE role_id = ?', [roleName, roleId]);
    }

    async rolePermissionIds(roleId: number | string): Promise<Array<number | string>> {
        const [rows] = await pool.query('SELECT permission_id FROM roleandpermission_middle WHERE role_id = ?', [roleId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return (rows as Array<AnyRow>).map((r) => r.permission_id as number | string);
    }

    /** 设置角色权限（事务：先清空再写入），对齐 legacy role_setPermission */
    async setRolePermission(roleId: number | string, permissionIdList: Array<unknown>): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const conn = await pool.getConnection();
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.beginTransaction();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.query('DELETE FROM roleandpermission_middle WHERE role_id = ?', [roleId]);
            for (const permission_id of permissionIdList) {
                if (permission_id !== undefined && permission_id !== null && permission_id !== '') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    await conn.query('INSERT INTO roleandpermission_middle (role_id, permission_id) VALUES (?, ?)', [
                        roleId,
                        permission_id,
                    ]);
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.commit();
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await conn.rollback();
            throw error;
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            conn.release();
        }
    }

    async permissionGetAll(): Promise<Array<AnyRow>> {
        const [rows] = await pool.query('SELECT * FROM permission');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return rows as Array<AnyRow>;
    }

    async permissionUpdate(permissionId: number | string, permissionName: string, permissionDescription?: unknown): Promise<void> {
        await pool.query('UPDATE permission SET permission_name = ?, permission_description = ? WHERE permission_id = ?', [
            permissionName,
            permissionDescription,
            permissionId,
        ]);
    }
}

export const rbacDao = new RbacDao();
