const express = require('express')
const router = express.Router()

router.get('/', async (req, res) => {
    res.json({
        code: 200,
        message: '你好，成功启动JScreate'
    })

})
module.exports = router