import React, { Component, Fragment } from 'react'
import ReactDOM from 'react-dom'
import NoStateChange from './NoStateChange.jsx'
import OptimizeNoStateChange from './OptimizeNoStateChange.jsx'

class App extends Component {
  render() {
    return (
      <Fragment>
        <h2>场景：</h2>
        <strong>给 React 组件的 state 设置相同的值，组件的 state 并未发生变化，React 组件是否会发生无用渲染？</strong>
        <div>
          <h4>测试：未性能优化</h4>
          <NoStateChange />
        </div>
        <div>
          <h4>测试：性能优化后</h4>
          <OptimizeNoStateChange />
        </div>
      </Fragment>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))