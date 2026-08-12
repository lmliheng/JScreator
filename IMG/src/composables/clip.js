
/**
 * 
 * @将内存变量复制到剪切板
 * 或者使用vueuse内置函数
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('复制成功:', text);
  } catch (err) {
    console.error('复制失败:', err);
  }
}

