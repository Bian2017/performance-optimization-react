import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

// 全局变量，用于记录组件渲染次数
let renderTimes = 0;
// 全局变量，记录组件的上次状态
let lastState = null;

class App extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      count: 1
    };
    lastState = this.state; // 初始化，地址保持一致
  }

  handleClick = () => {
    console.log(`当前组件状态是否是上一次状态：${this.state === lastState}`);

    this.setState({ count: 1 });
    // 更新上一次状态
    lastState = this.state;
  };

  render() {
    renderTimes += 1;

    return (
      <div>
        <h3>场景复现：</h3>
        <p>每次点击“设置”按钮，当前组件的状态都会被设置成相同的数值。</p>
        <p>当前组件的状态: {this.state.count}</p>
        <p>
          当前组件发生渲染的次数：
          <span style={{ color: 'red' }}>{renderTimes}</span>
        </p>
        <div>
          <button onClick={this.handleClick}>设置</button>
        </div>
      </div>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
