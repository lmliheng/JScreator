<script setup>
import { ref } from "vue";

defineOptions({
  name: "HTest",
});
</script>
<template>
  <div>hello</div>

  <div class="bg-blue-500 w-60 h-10 flex justify-start items-center" >
    <div id="icon" class='p-2'>
      <slot name="icon"> </slot>
    </div>
    <div id="defalut" class='flex-1 text-amber-50'>
      <slot> </slot>
    </div>
  </div>
</template>
<style scoped></style>
