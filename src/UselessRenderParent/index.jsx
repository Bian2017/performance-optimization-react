import React, { Component } from 'react'
import ReactDOM from 'react-dom'

import ChildClass from './ChildClass.jsx'
import ChildFunc from './ChildFunc.jsx'
import OpChildClass from './OpChildClass.jsx'
import OpChildFunc from './OpChildFunc.jsx'

class App extends Component {
  state = {
    cnt: 1
  }

  componentDidMount() {
    setInterval(() => this.setState({ cnt: this.state.cnt + 1 }), 2000)
  }

  render() {
    return (
      <div>
        <p>计算值: {this.state.cnt}</p>
        <ChildFunc />
        <ChildClass />
        <OpChildFunc />
        <OpChildClass />
      </div>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))
