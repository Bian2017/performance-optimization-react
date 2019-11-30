import React, { Component, Fragment } from 'react';
import ReactDOM from 'react-dom';
import ChildClass from './ChildClass.jsx';
import ChildFunc from './ChildFunc.jsx';

class App extends Component {
  state = {
    cnt: 1
  };

  componentDidMount() {
    setInterval(() => this.setState({ cnt: this.state.cnt + 1 }), 2000);
  }

  render() {
    return (
      <Fragment>
        <h2>疑问：</h2>
        <p>
          一个 React 组件，它包含两个子组件，分别是函数组件和 Class 组件。当这个 React 组件的 state
          发生变化时，两个子组件的 props 并没有发生变化，此时是否会导致函数子组件和 Class 子组件发生重复渲染呢？
        </p>
        <div>
          <h3>验证(性能优化前)：</h3>
          <ChildFunc />
          <ChildClass />
        </div>
      </Fragment>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
