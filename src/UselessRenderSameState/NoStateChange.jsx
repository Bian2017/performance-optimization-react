import React, { Component } from 'react'

// 全局变量，用于记录组件是否产生渲染
let test_cnt = 1

class NoStateChange extends Component {
  constructor(props) {
    super(props)
    this.state = {
      count: 1
    }
  }

  componentWillUpdate() {
    test_cnt = test_cnt + 1
  }

  handleClick = () => {
    this.setState({ count: 1 })
  }

  render() {
    return (
      <div>
        <p>每次点击“设置”按钮，数值count会被设置成相同值。</p>
        <p>当前count值: {this.state.count}</p>
        <p>组件发生渲染：{test_cnt}</p>
        <p>
          <button onClick={this.handleClick}>设置</button>
        </p>
      </div>
    )
  }
}

export default NoStateChange
