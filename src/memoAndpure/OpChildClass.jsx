import React, { PureComponent } from 'react'

let cnt = 0

class OpChildClass extends PureComponent {
  render() {
    cnt = cnt + 1
    console.log('已性能优化: class组件发生渲染')

    return <h4>Class组件: 已性能优化 --- {cnt}</h4>
  }
}

export default OpChildClass
