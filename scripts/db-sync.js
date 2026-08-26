/**
 * 数据库一键同步脚本（本地开发 → 云托管）
 *
 * 用法：
 *   node scripts/db-sync.js export                    # 导出本地库 → asset/SQL/<时间戳>-dump.sql（自动替换字符集）
 *   node scripts/db-sync.js import <file.sql>         # 导入指定 SQL 到目标库（默认本地；可 --host 指定云端公网地址）
 *   node scripts/db-sync.js list                      # 列出 asset/SQL 下最近的备份
 *
 * 覆盖参数（不传则读 .env）：
 *   --host=xxx --port=3306 --user=root --password=xxx --database=fastweb_test
 *
 * 说明：
 *   - 导出：mysqldump 全量导出（结构+数据），并把 utf8mb4_0900_ai_ci 替换为 utf8mb4_general_ci（云 MySQL 5.7 兼容）
 *   - 导入：目标库在云托管私有网络时，本地无法直连，需把 SQL 文件上传到云控制台导入；
 *           若云数据库开放了公网地址，可直接用 --host 指定公网地址导入
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SQL_DIR = path.join(__dirname, '..', 'asset', 'SQL');
const MYSQL_BIN_CANDIDATES = [
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
    '/usr/bin/mysqldump',
    '/usr/bin/mysql',
    'mysqldump',
    'mysql',
];

// 解析命令行参数
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--'));
const overrides = {};
for (const a of args) {
    if (a.startsWith('--') && a.includes('=')) {
        const [k, v] = a.slice(2).split('=');
        overrides[k] = v;
    }
}

const cfg = {
    host: overrides.host || process.env.DB_HOST || '127.0.0.1',
    port: overrides.port || process.env.DB_PORT || '3306',
    user: overrides.user || process.env.DB_USER || 'root',
    password: overrides.password || process.env.DB_PASSWORD || '',
    database: overrides.database || process.env.DB_NAME || 'fastweb_test',
};

function findBin(binary) {
    const candidates = MYSQL_BIN_CANDIDATES.filter((c) => c.toLowerCase().includes(binary));
    for (const c of candidates) {
        try {
            fs.accessSync(c, fs.constants.X_OK);
            return c;
        } catch (e) {
            if (c === binary) return binary; // 走 PATH
        }
    }
    // 逐个尝试，能找到哪个用哪个
    for (const c of candidates) {
        try {
            execFileSync(c, ['--version'], { stdio: 'ignore' });
            return c;
        } catch (e) {
            // 继续找
        }
    }
    throw new Error(`找不到 ${binary} 可执行文件，请修改 MYSQL_BIN_CANDIDATES`);
}

function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function doExport() {
    const mysqldump = findBin('mysqldump');
    if (!fs.existsSync(SQL_DIR)) fs.mkdirSync(SQL_DIR, { recursive: true });
    const outFile = path.join(SQL_DIR, `${cfg.database}-${timestamp()}-dump.sql`);

    console.log(`[导出] ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
    const cmd = [
        `--host=${cfg.host}`,
        `--port=${cfg.port}`,
        `--user=${cfg.user}`,
        `--password=${cfg.password}`,
        '--databases', cfg.database,
        '--result-file=' + outFile,
    ];
    execFileSync(mysqldump, cmd, { stdio: 'inherit' });

    // 字符集兼容：utf8mb4_0900_ai_ci → utf8mb4_general_ci（云 MySQL 5.7 不认 0900）
    const raw = fs.readFileSync(outFile, 'utf8');
    const count = (raw.match(/utf8mb4_0900_ai_ci/g) || []).length;
    if (count > 0) {
        fs.writeFileSync(outFile, raw.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci'), 'utf8');
        console.log(`[字符集] 替换 ${count} 处 utf8mb4_0900_ai_ci → utf8mb4_general_ci`);
    } else {
        console.log('[字符集] 无需替换');
    }

    const size = fs.statSync(outFile).size;
    console.log(`[完成] ${outFile} (${(size / 1024).toFixed(1)} KB)`);
    return outFile;
}

async function doImport(file) {
    if (!file) {
        console.error('用法: node scripts/db-sync.js import <file.sql> [--host=...]');
        process.exit(1);
    }
    const sqlFile = path.resolve(file);
    if (!fs.existsSync(sqlFile)) {
        console.error(`文件不存在: ${sqlFile}`);
        process.exit(1);
    }
    const mysql = findBin('mysql');
    console.log(`[导入] ${sqlFile} → ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
    console.log('       ⚠️  覆盖目标库现有数据，请确认');
    const cmd = [
        `--host=${cfg.host}`,
        `--port=${cfg.port}`,
        `--user=${cfg.user}`,
        `--password=${cfg.password}`,
        '--default-character-set=utf8mb4',
    ];
    // mysql < file
    const { execSync } = require('child_process');
    execSync(`"${mysql}" ${cmd.map((c) => '"' + c + '"').join(' ')} < "${sqlFile}"`, { stdio: 'inherit', shell: true });
    console.log('[完成] 导入成功');
}

function doList() {
    if (!fs.existsSync(SQL_DIR)) {
        console.log('asset/SQL 目录不存在');
        return;
    }
    const files = fs.readdirSync(SQL_DIR)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => {
            const st = fs.statSync(path.join(SQL_DIR, f));
            return { f, size: (st.size / 1024).toFixed(1) + ' KB', time: st.mtime.toLocaleString() };
        })
        .sort((a, b) => b.time.localeCompare(a.time));
    console.log('asset/SQL 下的备份：');
    files.forEach((x) => console.log(`  ${x.time}  ${x.size.padStart(10)}  ${x.f}`));
}

(async () => {
    try {
        if (command === 'export') {
            await doExport();
        } else if (command === 'import') {
            await doImport(args.find((a) => !a.startsWith('--') && a !== 'import'));
        } else if (command === 'list') {
            doList();
        } else {
            console.log(`
数据库同步脚本用法：
  node scripts/db-sync.js export                    # 导出本地库（含字符集替换）
  node scripts/db-sync.js import <file.sql>         # 导入（本地默认；云端公网用 --host=xx --password=xx）
  node scripts/db-sync.js list                      # 列出备份
`);
        }
    } catch (e) {
        console.error('\n[错误]', e.message || e);
        process.exit(1);
    }
})();
