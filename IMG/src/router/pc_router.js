export const pcRouter = [
    {
        path: '/',
        name: 'pc',
        component: () => import('@/views/main/index.vue')
    },
    
    {
        path:'/test',
        name:'test',
        component:()=>import('@/views/test/index.vue')
    },

]