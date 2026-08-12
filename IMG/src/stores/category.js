import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCategoryStore = defineStore('counter', () => {
  const categoryIdSelected = ref('all')
  const categorySelected = (val)=>{
    categoryIdSelected.value = val
  }

  
  return { categorySelected, categoryIdSelected }
},{
    persist: true
})
