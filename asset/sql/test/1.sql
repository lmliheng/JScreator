SELECT u.username, u.email, u.id, u.avatar, u.created_at, r.role_name, r.role_id, p.permission_name, p.permission_id
FROM
    user u
    JOIN role r ON u.role_id = r.role_id
    JOIN roleandpermission_middle rp ON rp.role_id = r.role_id
    JOIN permission p ON p.permission_id = rp.permission_id
WHERE
    u.id = 1778237621052;

SELECT * FROM user WHERE username = 'liheng2'

