export const mobileRouter = [
    {
        path: '/',
        name: 'mobile',
        component: () => import('@/views/main/index.vue')
    },
    {
        path: '/test',
        name: 'test',
        component: () => import('@/views/test/index.vue')
    }
]