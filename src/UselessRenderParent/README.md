# React 性能优化 —— 浅谈 PureComponent 组件 与 memo 组件

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

实际验证结果表明，无论是函数组件还是 Class 组件，只要父组件的 state 发生了变化，二者均会产生重复渲染，详见![性能优化前](https://raw.githubusercontent.com/Bian2017/performance-optimization-react/master/docs/img/ParentBeforeOptimization.gif)。

## 二、性能优化

- 针对函数组件，我们可以采用 memo 来减少重复渲染；
- 针对 Class 组件，则采用`PureComponent`组件来减少重复渲染；

实现逻辑如下：

**函数组件:**

```JS
import React, { PureComponent } from 'react';

let cnt = 0;

class ChildClass extends PureComponent {
  render() {
    cnt = cnt + 1;

    return <p>Class组件发生渲染次数: {cnt}</p>;
  }
}

export default ChildClass;
```

**Class 组件:**

```JS
import React, { PureComponent } from 'react';

let cnt = 0;

class ChildClass extends PureComponent {
  render() {
    cnt = cnt + 1;

    return <p>Class组件发生渲染次数: {cnt}</p>;
  }
}

export default ChildClass;
```

实际验证结果如下![性能优化后](https://raw.githubusercontent.com/Bian2017/performance-optimization-react/master/docs/img/ParentAfterOptimization.gif)。
下面浅谈下 PureComponent 组件和 memo 函数的实现。

## 三、PureComponent 组件

### 3.1 PureComponent 概念

以下内容摘自[React.PureComponent](https://zh-hans.reactjs.org/docs/react-api.html#reactpurecomponent)。

`React.PureComponent` 与 `React.Component` 很相似。两者的区别在于 `React.Component` 并未实现 `shouldComponentUpdate()`，而 `React.PureComponent` 中以浅层对比 prop 和 state 的方式来实现了该函数。

如果赋予 React 组件相同的 props 和 state，render() 函数会渲染相同的内容，那么在某些情况下使用 React.PureComponent 可提高性能。

**注意:**

> React.PureComponent 中的 shouldComponentUpdate() 仅作对象的浅层比较。如果对象中包含复杂的数据结构，则有可能因为无法检查深层的差别，产生错误的比对结果。仅在你的 props 和 state 较为简单时，才使用 React.PureComponent，或者在深层数据结构发生变化时调用 forceUpdate() 来确保组件被正确地更新。你也可以考虑使用 immutable 对象加速嵌套数据的比较。

> 此外，React.PureComponent 中的 shouldComponentUpdate() 将跳过所有**子组件树**的 prop 更新。因此，请确保所有子组件也都是“纯”的组件。

### 3.2 PureComponent 性能优化实现机制

#### 3.2.1 PureComponent 组件定义

以下代码摘自 React v16.9.0 中的 `ReactBaseClasses.js`文件。

```JS
// ComponentDummy起桥接作用，用于PureComponent实现一个正确的原型链，其原型指向Component.prototype
function ComponentDummy() {}
ComponentDummy.prototype = Component.prototype;

// 定义PureComponent构造函数
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

// 将PureComponent的原型指向一个新的对象，该对象的原型正好指向Component.prototype
const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());

// 将PureComponent原型的构造函数修复为PureComponent
pureComponentPrototype.constructor = PureComponent;

// Avoid an extra prototype jump for these methods.
Object.assign(pureComponentPrototype, Component.prototype);

// 创建标识isPureReactComponent，用于标记是否是PureComponent
pureComponentPrototype.isPureReactComponent = true;
```

#### 3.2.2 PureComponent 组件的性能优化实现机制

**名词解释：**

- work-in-progress(简写 WIP: 半成品)：表示尚未完成的 Fiber，也就是尚未返回的堆栈帧，对象 workInProgress 是 reconcile 过程中从 Fiber 建立的当前进度快照，用于断点恢复。

以下代码摘自 React v16.9.0 中的 `ReactFiberClassComponent.js`文件。

```JS
function checkShouldComponentUpdate(
  workInProgress,
  ctor,
  oldProps,
  newProps,
  oldState,
  newState,
  nextContext,
) {
  const instance = workInProgress.stateNode;

  // 如果这个组件实例自定义了shouldComponentUpdate生命周期函数
  if (typeof instance.shouldComponentUpdate === 'function') {
    startPhaseTimer(workInProgress, 'shouldComponentUpdate');

    // 执行这个组件实例自定义的shouldComponentUpdate生命周期函数
    const shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      nextContext,
    );
    stopPhaseTimer();

    return shouldUpdate;
  }

  // 判断当前组件实例是否是PureReactComponent
  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (
     /**
      * 1. 浅比较判断 oldProps 与newProps 是否相等；
      * 2. 浅比较判断 oldState 与newState 是否相等；
      */
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    );
  }

  return true;
}
```

由上述代码可以看出，如果一个 PureComponent 组件自定义了`shouldComponentUpdate`生命周期函数，则该组件是否进行渲染取决于`shouldComponentUpdate`生命周期函数的执行结果，不会再进行额外的浅比较。如果未定义该生命周期函数，才会浅比较状态 state 和 props。

## 四、memo 组件

### 4.1 React.memo 概念

以下内容摘自[React.memo](https://zh-hans.reactjs.org/docs/react-api.html#reactmemo)。

```JS
const MyComponent = React.memo(function MyComponent(props) {
  /* 使用 props 渲染 */
});
```

`React.memo`为**高阶组件**。它与`React.PureComponent`非常相似，但它适用于函数组件，但不适用于 class 组件。

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

### 4.2 React.memo 性能优化实现机制

#### 4.2.1 memo 函数定义

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

其中：

- type：表示自定义的 React 组件；
- compare：表示自定义的性能优化函数，类似`shouldcomponentupdate`生命周期函数；

#### 4.2.2 memo 函数的性能优化实现机制

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
