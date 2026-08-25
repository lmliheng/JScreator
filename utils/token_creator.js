const jwt = require('jsonwebtoken')


const tokenCreator = (user) => {
    const token = jwt.sign(
        {
            id: user.id,
            role_id: user.role_id
        },
        process.env.JWT_SECRET || 'test',
        {
            expiresIn: '7d'
        }
    );
    return token
}

/**
 * 
 * @Token解析
 * 1.可以去除Bearer
 * 2. 检查环境变量是否生效
 */
const tokenValidator = (token) => {
    try {
        // 去掉可能的 "Bearer " 前缀
        if (typeof token === 'string' && token.startsWith('Bearer ')) {
            token = token.slice(7)
        }
        if (process.env.JWT_SECRET == '') {
            console.warn('JWT_SECRET未配置，使用默认配置：test')
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test');
        return decoded;
    } catch (error) {
        return null;
    }
}

const validResultCheck = (res) => {
    try {
        if (typeof res !== 'object') {
            return false
        }
        if (res.id == undefined) {
            return false
        }
        return true

    } catch (e) {
        console.error("validResultCheck函数错误：", e)
    }
}

module.exports = {
    tokenCreator, tokenValidator, validResultCheck
}
