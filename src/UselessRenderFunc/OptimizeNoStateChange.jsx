import React, { Component } from 'react'
import ReactDOM from 'react-dom'

let test_cnt = 0

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      count: 1,
      testObj: {
        cnt: 0
      }
    }
  }

  componentWillUpdate(nextProps, nextState) {
    console.log('state:', this.state)
    console.log('nextState:', nextState)
    console.log('true:', this.state.testObj === nextState.testObj)
    console.log('componentWillUpdate')
    test_cnt = test_cnt + 1
  }

  componentDidUpdate(prevProps, prevState) {
    console.log('componentDidUpdate')
  }

  handleClick = () => {
    this.setState({ count: 1 })
  }

  handleClick1 = () => {
    let cnt = this.state.testObj
    cnt.cnt = 1
    this.setState({ testObj: cnt })
  }

  render() {
    return (
      <div>
        <h4>每次点击“试验”按钮，数值count会被设置成相同值</h4>
        <p>数值count: {this.state.count}</p>
        <button onClick={this.handleClick}>试验</button>

        {this.state.testObj.cnt}
        <button onClick={this.handleClick1}>Click Me</button>
        <div>组件发生渲染：{test_cnt}</div>
      </div>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))
