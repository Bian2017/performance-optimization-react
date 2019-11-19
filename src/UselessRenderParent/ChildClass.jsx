import React, { Fragment, Component } from 'react'

let cnt = 0

class ChildClass extends Component {
  render() {
    cnt = cnt + 1
    console.log('未性能优化: class组件发生渲染')

    return (
      <Fragment>
        <h4>Class组件: 未性能优化 --- {cnt}</h4>
      </Fragment>
    )
  }
}

export default ChildClass
