import React, { memo } from 'react'

let cnt = 0

const OpChildFunc = () => {
  console.log('性能优化组件: 函数组件发生渲染')
  cnt = cnt + 1

  return <h4>函数组件: 已性能优化 --- {cnt}</h4>
}

export default memo(OpChildFunc)
