import {api} from '@/composables/useAxiosConfig'
export const requestCategory = () => {
  return api.get('/category')
}


export const getImageList = (query) => {
  return api.get('/pexels/list', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      searchText: query.searchText
    }
  })
}