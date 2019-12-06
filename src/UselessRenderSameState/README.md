## 浅谈 setState 更新机制

了解 React 同学想必对`setState`函数是再熟悉不过了，`setState`也会经常作为面试题，考察前端求职者对 React 的熟悉程度。

在此我也抛一个问题，阅读文章前读者可以先想一下这个问题答案。

> 给 React 组件的 state 每次设置相同的值，如`setState({count: 1})`。React 组件是否会发生重复渲染呢？如果是，为什么？如果不是，那又是为什么？

## 一、场景复现

针对上述问题，先进行一个简单的复现验证。

![场景复现](https://raw.githubusercontent.com/Bian2017/performance-optimization-react/master/docs/img/sameStateRecurrent.png)

如图所示，App 组件有个设置按钮，每次点击设置按钮，都会对当前组件的状态设置相同的值`{count: 1}`，我们通过全局变量`renderTimes`来记录页面发生渲染的次数。

**App 组件**

```JS
import React, { Component } from 'react';
import ReactDOM from 'react-dom';

// 全局变量，用于记录组件渲染次数
let renderTimes = 0;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      count: 1
    };
  }

  handleClick = () => {
    this.setState({ count: 1 });
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
```

实际验证结果如下所示，每次点击设置按钮，App 组件均会产生重复渲染。

![场景复现操作](https://raw.githubusercontent.com/Bian2017/performance-optimization-react/master/docs/img/sameStateRecurrentOps.gif)

## 二、性能优化

那么该如何减少 App 组价发生重复渲染呢？之前在 [React 性能优化——浅谈 PureComponent 组件与 memo 组件](https://juejin.im/post/5de364a4f265da05be3e5af3) 这一文中，详细介绍了`PureComponent`的定义以及内部实现机制。此处可利用`PureComponent`组件来减少重复渲染。

实际验证结果如下图所示，优化后的 App 组件不再产生重复渲染。

![]()

但这个有个细节问题，可能大家平时并未想过，即：

> 我们利用 `PureComponent` 减少了 App 组件的重复渲染，那么 App 组件的 state 是否产生变化，即引用地址依旧是上次的地址吗？

废话不多说，我们针对这一问题进行下复现验证。

```JS
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
```

经验证发现，虽然 PureComponent 减少了 App 组件的重复渲染，但是 App 组件的 state 的引用地址却发生了变化，这是为什么呢？

下面结合 React V16.9.0 源码，浅谈下 setState 的更新机制。以下对源码存在部分删减，方便更快理解源码。

是依旧会发生重复渲染，详见[样例展示](https://bian2017.github.io/performance-optimization-react/UselessRenderSameState.html)。

## 三、浅谈 setState 更新机制

![setState更新机制](https://raw.githubusercontent.com/Bian2017/performance-optimization-react/master/docs/img/updateState.jpg)

从上图可以看出，setState 操作主要分成两大块：

- 将更新的状态添加至更新队列中；
- 从更新队列中取出要更新的状态，计算出最终要更新的状态，更新到组件实例中，然后完成组件的渲染。

### 3.1 入队列

#### 3.1.1 setState 函数定义

摘自`ReactBaseClasses.js`文件。

```JS
Component.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

函数`setState`包含两个参数`partialState`和`callback`，其中`partialState`表示待更新的部分状态，`callback`则为状态更新后的回调函数。

#### 3.1.2 enqueueSetState 函数定义

摘自`ReactFiberClassComponent.js`文件。

```JS
enqueueSetState(inst, payload, callback) {
  const fiber = getInstance(inst);
  const currentTime = requestCurrentTime();
  const suspenseConfig = requestCurrentSuspenseConfig();
  const expirationTime = computeExpirationForFiber(
    currentTime,
    fiber,
    suspenseConfig,
  );

  // 创建一个update对象
  const update = createUpdate(expirationTime, suspenseConfig);
  // payload存放的是要更新的状态，即partialState
  update.payload = payload;

  // 如果定义了callback，则将callback挂载在update对象上
  if (callback !== undefined && callback !== null) {
    update.callback = callback;
  }

  // ...省略...

  // 将update对象添加至更新队列中
  enqueueUpdate(fiber, update);
  // 添加调度任务
  scheduleWork(fiber, expirationTime);
},
```

函数`enqueueSetState`会创建一个`update`对象，并将要更新的状态`partialState`、状态更新后的回调函数`callback`和渲染的过期时间`expirationTime`等都会挂载在该对象上。然后将该`update`对象添加到更新队列中，并且产生一个调度任务。

若组件渲染之前多次调用了`setState`，则会产生多个`update`对象，会被依次添加到更新队列中，同时也会产生多个调度任务。

#### 3.1.3 createUpdate 函数定义

摘自 `ReactUpdateQueue.js`文件。

```ts
export function createUpdate(
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
): Update<*> {
  let update: Update<*> = {
    expirationTime,
    suspenseConfig,

    // 添加TAG标识，表示当前操作是UpdateState，后续会用到。
    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
    nextEffect: null,
  };

  return update;
}
```

函数`createUpdate`会创建一个`update`对象，用于存放更新的状态`partialState`、状态更新后的回调函数`callback`和渲染的过期时间`expirationTime`。

### 3.2 setState 状态更新机制

从上图可以看出，每次调用`setState`函数都会创建一个调度任务。然后经过一系列函数调用，最终会调起函数`updateClassComponent`。

图中红色区域涉及知识点较多，与我们要讨论的状态更新机制关系不大，不是我们此次的讨论重点，所以我们先行跳过，待后续研究(挖坑)。

下面我们简单聊一下组件的状态是如何一步步完成更新的。

#### 3.2.1 getStateFromUpdate 函数

摘自 `ReactUpdateQueue.js`文件。

```JS
function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any,
): any {
  switch (update.tag) {

    // ....省略 ....

    // 见3.3节内容，调用setState会创建update对象，其属性tag当时被标记为UpdateState
    case UpdateState: {
      // payload 存放的是要更新的状态state
      const payload = update.payload;
      let partialState;

      // 获取要更新的状态
      if (typeof payload === 'function') {
        partialState = payload.call(instance, prevState, nextProps);
      } else {
        partialState = payload;
      }

      // partialState 为null 或者 undefined，则视为未操作，返回上次状态
      if (partialState === null || partialState === undefined) {
        return prevState;
      }

      // 注意：此处通过Object.assign生成一个全新的状态state， state的引用地址发生了变化。
      return Object.assign({}, prevState, partialState);
    }

    // .... 省略 ....
  }

  return prevState;
}
```

`getStateFromUpdate` 函数主要功能是将存储在更新对象`update`上的`partialState`与上一次的`prevState`进行对象合并，生成一个全新的状态 state。

**注意：**

- `Object.assign` 第一个参数是空对象，也就是说新的 state 对象的引用地址发生了变化。
- `Object.assign` 进行的是浅拷贝，不是深拷贝。

#### 3.2.2 processUpdateQueue 函数

摘自 `ReactUpdateQueue.js`文件。

```JS
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  props: any,
  instance: any,
  renderExpirationTime: ExpirationTime,
): void {
  // ...省略...

  // 获取上次状态prevState
  let newBaseState = queue.baseState;

  /**
   * 若在render之前多次调用了setState，则会产生多个update对象。这些update对象会以链表的形式存在queue中。
   * 现在对这个更新队列进行依次遍历，并计算出最终要更新的状态state。
   */
  let update = queue.firstUpdate;
  let resultState = newBaseState;
  while (update !== null) {
    // ...省略...

    /**
     * resultState作为参数prevState传入getStateFromUpdate，然后getStateFromUpdate会合并生成
     * 新的状态再次赋值给resultState。完成整个循环遍历，resultState即为最终要更新的state。
     */
    resultState = getStateFromUpdate(
      workInProgress,
      queue,
      update,
      resultState,
      props,
      instance,
    );
    // ...省略...

    // 遍历下一个update对象
    update = update.next;
  }

  // ...省略...

  // 将处理后的resultState更新到workInProgess上
  workInProgress.memoizedState = resultState;
}
```

React 组件渲染之前，我们通常会多次调用`setState`，每次调用`setState`都会产生一个 update 对象。这些 update 对象会以链表的形式存在队列 queue 中。`processUpdateQueue`函数会对这个队列进行依次遍历，每次遍历会将上一次的`prevState`与 update 对象的`partialState`进行合并，当完成所有遍历后，就能算出最终要更新的状态 state，此时会将其存储在 workInProgress 的`memoizedState`属性上。

#### 3.2.3 updateClassInstance 函数

摘自 `ReactFiberClassComponent.js`文件。

```JS
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime,
): boolean {
  // 获取当前实例
  const instance = workInProgress.stateNode;

  // ...省略...

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  let updateQueue = workInProgress.updateQueue;

  // 如果更新队列不为空，则处理更新队列，并将最终要更新的state赋值给newState
  if (updateQueue !== null) {
    processUpdateQueue(
      workInProgress,
      updateQueue,
      newProps,
      instance,
      renderExpirationTime,
    );
    newState = workInProgress.memoizedState;
  }

  // ...省略...

  /**
   * shouldUpdate用于标识组件是否要进行渲染，其值取决于组件的shouldComponentUpdate生命周期执行结果，
   * 亦或者PureComponent的浅比较的返回结果。
   */
  const shouldUpdate = checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext,
    );

  if (shouldUpdate) {
     // 如果需要更新，则执行相应的生命周期函数
     if (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function') {
      startPhaseTimer(workInProgress, 'componentWillUpdate');
      if (typeof instance.componentWillUpdate === 'function') {
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
      stopPhaseTimer();
    }
    // ...省略...
  }

  // ...省略...

  /**
   * 不管shouldUpdate的值是true还是false，都会更新当前组件实例的props和state的值，
   * 即组件实例的state和props的引用地址发生变化。也就是说即使我们采用PureComponent来减少无用渲染，
   * 但并不代表该组件的state或者props的引用地址没有发生变化！！！
   */
  instance.props = newProps;
  instance.state = newState;

  return shouldUpdate;
}
```

从上述代码可以看出，`updateClassInstance`函数主要实现了以下几个功能：

- 遍历更新队列，产生一个全新的 state，并将其更新至组件实例的 state 上；
- 返回是否要进行更新的标识 `shouldUpdate`，该值的运行结果取决于`shouldComponentUpdate`生命周期函数执行结果或者`PureComponent`的浅比较结果；
- 如果 `shouldUpdate` 的值为`true`，则执行相应生命周期函数`componentWillUpdate`；

此时要特别注意以下几点：

1. 组件实例的状态 state 发生变化，即引用地址发生变化；
2. 即使采用`PureComponent`或者`shouldComponentUpdate`来减少无用渲染，但组件实例的 props 或者 state 的引用地址也依旧发生了变化。

代码解读到此处，想必大家对之前提到的两个疑问都有了答案吧。

#### 3.2.4 updateClassComponent 函数

```JS
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps,
  renderExpirationTime: ExpirationTime,
) {
  // 获取组件实例
  const instance = workInProgress.stateNode;

  // ...省略...

  let shouldUpdate;

  /**
   * 1. 完成组件实例的state、props的更新;
   * 2. componentWillUpdate、shouldComponentUpdate生命周期函数执行完毕；
   * 3. 获取是否要进行更新的标识shouldUpdate；
   */
  shouldUpdate = updateClassInstance(
    current,
    workInProgress,
    Component,
    nextProps,
    renderExpirationTime,
  );

  /**
   * 1. 如果shouldUpdate值为false，则退出渲染；
   * 2. 执行render函数
   */
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    hasContext,
    renderExpirationTime,
  );

  // 返回下一个任务单元
  return nextUnitOfWork;
}
```

从上述代码可以看出，`updateClassComponent`函数主要实现了以下几个功能：

- 完成组件实例的 state、props 的更新;
- 执行 `componentWillUpdate`、`shouldComponentUpdate`等生命周期函数；
- 完成组件实例的渲染；
- 返回下一个待处理的任务单元；

## 四、小结

每次调用 setState，都会创建一个全新的 state，并引起组件的重新渲染。即使使用`PureComponent`进行性能优化，组件的 state 的引用地址依旧产生了变化。

如果大家觉得博文还不错，那就帮忙点个赞吧。
