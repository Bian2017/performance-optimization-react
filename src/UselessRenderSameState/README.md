## React 性能优化

**场景：**

给 React 组件的 state 设置相同的值，组件的 state 并未发生变化，React 组件是否会发生无用渲染？

代码逻辑如下：

```JS
import React, { Component } from 'react'

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
```

### 验证

实际验证结果是依旧会发生重复渲染，[样例展示](https://bian2017.github.io/performance-optimization-react/UselessRenderSameState.html)。

更多验证代码，见[样例代码](https://github.com/Bian2017/performance-optimization-react/tree/master/src/UselessRenderSameState)。

### 原因

以下代码摘自 React V0.12.0 版本。

```JS
var assign = require('Object.assign');

/*
...省略...
*/
  setState: function(partialState, callback) {
    // Merge with `_pendingState` if it exists, otherwise with existing state.
    this.replaceState(
      assign({}, this._pendingState || this.state, partialState),
      callback
    );
  },
```

每次调用 setState，React 会通过 Object.assign 生成一个新的对象(引用地址发生变化)，然后重新执行渲染逻辑。

因此进行性能优化的时候，不能简单以为值未发生变化，就直接比较 this.state 与 nextState。

**错误示范:**

```JS
shouldComponentUpdate(nextProps, nextState) {
  if(this.state === nextState) {
    return false
  }
}
```

### 性能优化

针对上述场景，可以通过使用 PureComponent 来减少无用的渲染。

```JS
import React, { PureComponent } from 'react'

let test_cnt = 1

class NoStateChange extends PureComponent {
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
        <p>每次点击“试验”按钮，数值count会被设置成相同值。</p>
        <p>当前count值: {this.state.count}</p>
        <p>组件发生渲染：{test_cnt}</p>
        <p>
          <button onClick={this.handleClick}>试验</button>
        </p>
      </div>
    )
  }
}

export default NoStateChange
```

PureComponent 内部通过对 props 和 state 进行了浅比较(shallowEqual)来决定是否要进行渲染。代码如下，摘自 React v15.6.0 中的 ReactCompositeComponent.js 文件。

```JS
if (!this._pendingForceUpdate) {
    // 如果当前实例定义了shouldComponentUpdate，则执行实例shouldComponentUpdate
    if (inst.shouldComponentUpdate) {
      shouldUpdate = inst.shouldComponentUpdate(
        nextProps,
        nextState,
        nextContext,
      );
    } else {
      // 判断当前是否PureComponent
      if (this._compositeType === CompositeTypes.PureClass) {
        shouldUpdate =
          !shallowEqual(prevProps, nextProps) ||
          !shallowEqual(inst.state, nextState);
      }
    }
  }
```
