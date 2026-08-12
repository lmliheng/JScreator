<script setup>
import { ref, onMounted } from "vue";
import { H_Events } from "@/constants/index.js";

//=====组件定义====
defineOptions({
  name: "HDropMenus",
});

//======组件状态数据=====
// drop_position调整菜单位置
const positionClassMap = {
  top: "top-0 left-0 transform -translate-x-1/3 -translate-y-full",
  bottom: "top-full left-0 transform -translate-x-1/3 mt-2",
  left: "top-1/2 left-0 transform -translate-y-1/2 -translate-x-full",
  right: "top-1/2 right-0 transform -translate-y-1/2 translate-x-full",
  "bottom-left": "top-full right-0  transform -translate-x-1/3 mt-2",
  "bottom-right": "top-full left-0  mt-2",
  "top-left": "top-0 left-0 transform -translate-y-full",
  "top-right": "top-0 right-0 transform -translate-y-full",
  "left-top": "top-0 left-0 transform -translate-x-full",
  "left-bottom": "bottom-0 left-0 transform -translate-x-full",
  "right-top": "top-0 right-0 transform translate-x-full",
  "right-bottom": "bottom-0 right-0 transform translate-x-full",
};
const showMenu = ref(false);

//=======props定义=======
const props = defineProps({
  //   showMenu: {         误区：组件封装不需要暴露showMenu状态！
  //     type: Boolean,
  //     default: false,
  //   },

  // 菜单显示隐藏的过渡动画，默认为dropdown
  menu_transition: {
    type: String,
    default: "dropdown",
  },
  drop_position: {
    type: String,
    default: "bottom-right",
    validator: (val) =>
      [
        "top",
        "bottom",
        "left",
        "right",
        "bottom-left",
        "bottom-right",
        "top-left",
        "top-right",
        "left-top",
        "left-bottom",
        "right-top",
        "right-bottom",
      ].includes(val),
  },
  
});

//=======事件处理=======
// 事件：鼠标置于之上会显示菜单，鼠标离开会隐藏菜单，item点击事件
const emit = defineEmits([H_Events.MOUSE_ENTER, H_Events.MOUSE_LEAVE]);

const handleMouseEnter = () => {
  showMenu.value = true;
  emit(H_Events.MOUSE_ENTER);
};

const handleMouseLeave = () => {
  showMenu.value = false;
  emit(H_Events.MOUSE_LEAVE);
};
</script>

<template>
  <div
    id="menus-header"
    class="cursor-pointer hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800 duration-300 rounded-md h-8 py-2 w-[40px] flex justify-center items-center relative"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"

  >
  
    <slot> </slot>
    <Transition :name="props.menu_transition">
      <div
        v-show="showMenu"
        id="menus-body"
        class="absolute bg-gray-50 shadow-md mt-2 rounded z-10  dark:bg-gray-700"
        :class="positionClassMap[props.drop_position]"
      >
        <!-- 支持具名插槽，且仅限于HDropMenusItem组件 -->
        <slot name="dropmenus"> </slot>
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.5s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
