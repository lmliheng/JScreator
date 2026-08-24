import axios from 'axios'

const api = axios.create({
    baseURL: 'http://127.0.0.1:7000',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        // 'icode': 'helloqianduanxunlianying'
    }
})

api.interceptors.request.use(
    config => {
        if (localStorage.getItem('auth')) {
            let auth = localStorage.getItem('auth')
            config.headers.Authorization = 'Bearer ' + JSON.parse(auth).token
        }
        return config
    },
    error => {
        return Promise.reject(error)
    }
)

api.interceptors.response.use(
    response => {
        return response.data
    },
    error => {
        return Promise.reject(error)
    }
)

export { api }