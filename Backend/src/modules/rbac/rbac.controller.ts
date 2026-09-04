/**
 * modules/rbac/rbac.controller —— /role/*、/permission/* HTTP 层。
 * 成功/失败响应对齐 legacy（role_request.js / permission_request.js）。
 */
import type { Request, Response } from 'express';
import type { RbacDao } from './rbac.dao.js';

function fail(res: Response, code: number, message: string): void {
    res.status(code).json({ code, success: false, message });
}

export class RbacController {
    constructor(private readonly dao: RbacDao) {}

    // ================= role =================
    roleList = async (_req: Request, res: Response): Promise<void> => {
        try {
            const roles = await this.dao.roleGetAll();
            res.json({ code: 200, success: true, message: '获取所有角色成功', data: { list: roles } });
        } catch (error) {
            console.error('获取所有角色错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    rolePermission = async (req: Request, res: Response): Promise<void> => {
        try {
            const permission_ids = await this.dao.rolePermissionIds(req.params.id as string);
            res.json({ code: 200, success: true, message: '获取角色权限成功', data: { permission_ids } });
        } catch (error) {
            console.error('获取角色权限错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    roleSetPermission = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { role_id?: unknown; permission_id_list?: unknown };
        if (!body.role_id || !Array.isArray(body.permission_id_list)) {
            return fail(res, 400, 'role_id 与 permission_id_list(数组) 不能为空');
        }
        try {
            await this.dao.setRolePermission(body.role_id as number | string, body.permission_id_list);
            res.json({ code: 200, success: true, message: '分配角色权限成功' });
        } catch (error) {
            console.error('分配角色权限错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    roleAdd = async (req: Request, res: Response): Promise<void> => {
        const role_name = String((req.body ?? {}).role_name ?? '');
        if (!role_name) return fail(res, 400, '角色名不能为空');
        try {
            await this.dao.roleAdd(role_name);
            res.json({ code: 200, success: true, message: '增加角色成功' });
        } catch (error) {
            console.error('增加角色错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    roleUpdate = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as { role_id?: unknown; role_name?: unknown };
        if (!body.role_id || !body.role_name) return fail(res, 400, '角色id与角色名不能为空');
        try {
            await this.dao.roleUpdateName(body.role_id as number | string, String(body.role_name));
            res.json({ code: 200, success: true, message: '修改角色名成功' });
        } catch (error) {
            console.error('修改角色名错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    roleDelete = async (req: Request, res: Response): Promise<void> => {
        const role_id = (req.body ?? {}).role_id;
        if (!role_id) return fail(res, 400, '角色id不能为空');
        try {
            await this.dao.roleDelete(role_id as number | string);
            res.json({ code: 200, success: true, message: '删除角色成功' });
        } catch (error) {
            console.error('删除角色错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    // ================= permission =================
    permissionList = async (_req: Request, res: Response): Promise<void> => {
        try {
            const permissions = await this.dao.permissionGetAll();
            res.json({ code: 200, success: true, message: '获取所有权限成功', data: { list: permissions } });
        } catch (error) {
            console.error('获取所有权限错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };

    permissionUpdate = async (req: Request, res: Response): Promise<void> => {
        const body = (req.body ?? {}) as {
            permission_id?: unknown;
            permission_name?: unknown;
            permission_description?: unknown;
        };
        if (!body.permission_id || !body.permission_name) {
            return fail(res, 400, '权限id与权限名不能为空');
        }
        try {
            await this.dao.permissionUpdate(body.permission_id as number | string, String(body.permission_name), body.permission_description);
            res.json({ code: 200, success: true, message: '修改权限成功' });
        } catch (error) {
            console.error('修改权限错误:', error);
            fail(res, 500, '服务器内部错误');
        }
    };
}
