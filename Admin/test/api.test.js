import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/composables/useAxiosConfig', () => ({
  api: vi.fn()
}))

import { api } from '../src/composables/useAxiosConfig'
import { login, requestUserInfo } from '../src/composables/useRequest'

describe('接口函数', () => {


  it('login 应携带 md5 后的密码', () => {
    api.mockResolvedValue({ data: { token: 'xxx' } })
    login('admin', '123456')
    expect(api).toHaveBeenCalledWith({
      url: '/sys/login',
      method: 'post',
      data: {
        username: 'admin',
        password: 'e10adc3949ba59abbe56e057f20f883e' // md5('123456')
      }
    })
  })


  it('requestUserInfo 请求 /sys/profile', () => {
    api.mockResolvedValue({ data: { name: '张三' } })
    requestUserInfo()
    expect(api).toHaveBeenCalledWith({
      url: '/sys/profile',
      method: 'get'
    })
  })


  
})