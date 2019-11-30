# React 性能优化(二) —— memo 组件和 PureComponent 组件

---

在谈性能优化之前，先抛出一个问题：

> 一个 React 组件，它包含两个子组件，分别是函数组件和 Class 组件。当这个 React 组件的 state 发生变化时，两个子组件的 props 并没有发生变化，此时是否会导致函数子组件和 Class 子组件发生重复渲染呢？

曾拿这个问题问过不少前端求职者，但很少能给出正确的答案。下面就这个问题，浅谈下自己的认识。

## 一、场景复现

针对上述问题，先进行一个简单复现，代码如下：

**父组件：**

```JS
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
```

**Class 组件：**

```JS
import React, { Component } from 'react';

let cnt = 0;

class ChildClass extends Component {
  render() {
    cnt = cnt + 1;

    return <p>Class组件发生渲染次数: {cnt}</p>;
  }
}

export default ChildClass;
```

**函数组件：**

```JS
import React from 'react';

let cnt = 0;

const ChildFunc = () => {
  cnt = cnt + 1;

  return <p>函数组件发生渲染次数: {cnt}</p>;
};

export default ChildFunc;
```

### 二、性能优化之 React.memo 组件

#### 2.1 React.memo 概念

以下内容摘自[React.memo](https://zh-hans.reactjs.org/docs/react-api.html#reactmemo)。

```JS
const MyComponent = React.memo(function MyComponent(props) {
  /* 使用 props 渲染 */
});
```

`React.memo`为高阶组件。它与`React.PureComponent`非常相似，但它适用于函数组件，但不适用于 class 组件。

如果你的函数组件在给定相同`props`的情况下渲染相同的结果，那么你可以通过将其包装在`React.memo`中调用，以此通过记忆组件渲染结果的方式来提高组件的性能表现。这意味着在这种情况下，React 将跳过渲染组件的操作并**直接复用**最近一次渲染的结果。

默认情况下其只会对复杂对象做**浅层对比**，如果你想要控制对比过程，那么请将自定义的比较函数通过第二个参数传入来实现。

```JS
function MyComponent(props) {
  /* 使用 props 渲染 */
}

function areEqual(prevProps, nextProps) {
  /*
  如果把 nextProps 传入 render 方法的返回结果与
  将 prevProps 传入 render 方法的返回结果一致则返回 true，
  否则返回 false
  */
}

export default React.memo(MyComponent, areEqual);
```

此方法仅作为性能优化的方式而存在。但请不要依赖它来“阻止”渲染，因为这会产生 bug。

> **注意**
> 与 class 组件中 shouldComponentUpdate() 方法不同的是，如果 props 相等，areEqual 会返回 true；如果 props 不相等，则返回 false。这与 shouldComponentUpdate 方法的返回值相反。

#### 2.2 React.memo 性能优化实现机制

##### 2.2.1 memo 函数定义

我们先看下在 React 中 memo 函数是如何定义的，以下代码摘自 React v16.9.0 中的`memo.js`文件。

```TS
export default function memo<Props>(
  type: React$ElementType,
  compare?: (oldProps: Props, newProps: Props) => boolean,
) {
  return {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  };
}
```

- type：表示自定义的 React 组件；
- compare：表示自定义的性能优化函数，类似`shouldcomponentupdate`生命周期函数；

##### 2.2.2 memo 函数的性能优化实现机制

**名词解释：**

- work-in-progress(简写 WIP: 半成品)：表示尚未完成的 Fiber，也就是尚未返回的堆栈帧，对象 workInProgress 是 reconcile 过程中从 Fiber 建立的当前进度快照，用于断点恢复。

以下代码摘自 React v16.9.0 中的 `ReactFiberBeginWork.js`文件。

```TS
function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  updateExpirationTime,
  renderExpirationTime: ExpirationTime,
): null | Fiber {

  /* ...省略...*/

  // 判断更新的过期时间是否小于渲染的过期时间
  if (updateExpirationTime < renderExpirationTime) {
    const prevProps = currentChild.memoizedProps;

    // 如果自定义了compare函数，则采用自定义的compare函数，否则采用官方的shallowEqual(浅比较)函数。
    let compare = Component.compare;
    compare = compare !== null ? compare : shallowEqual;

    /**
     * 1. 判断当前 props 与 nextProps 是否相等；
     * 2. 判断即将渲染组件的引用是否与workInProgress Fiber中的引用是否一致；
     *
     * 只有两者都为真，才会退出渲染。
     */
    if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
      // 如果都为真，则退出渲染
      return bailoutOnAlreadyFinishedWork(
        current,
        workInProgress,
        renderExpirationTime,
      );
    }
  }

  /* ...省略...*/
}
```

由上述代码可以看出，`updateMemoComponent`函数决定是否退出渲染取决于以下两点：

- 当前 props 与 nextProps 是否相等；
- 即将渲染组件的引用是否与 workInProgress Fiber 中的引用是否一致；

只有二者都为真，才会退出渲染。
