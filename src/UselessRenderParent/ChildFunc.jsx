import React from 'react'

let cnt = 0

const ChildFunc = () => {
  console.log('未性能优化: 函数组件发生渲染')
  cnt = cnt + 1

  return <h4>函数组件: 未性能优化 --- {cnt}</h4>
}

export default ChildFunc
