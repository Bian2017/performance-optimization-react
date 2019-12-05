## 浅谈 setState 更新机制

熟悉 React 同学想必对 setState 是再熟悉不过了，那么我在这抛一个问题，阅读文章的读者可以先内心想一下问题答案。

> 给 React 组件的 state 设置相同的值，组件的 state 并未发生变化，React 组件是否会发生重复渲染呢？

## 一、场景复现

针对上述问题，先进行一个简单的复现验证。

App 组件有个设置按钮，每次点击`设置`按钮，都会对当前组件的 state 设置相同的值`{count: 1}`。然后我们通过全局变量 count 来记录页面渲染次数。

**App 组件**

```JS
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
```

实际验证结果表明，如下图所示，每次点击设置按钮，App 组件均会产生重复渲染。

## 二、性能优化

那么该如何减少 App 组价发生重复渲染呢？在 React 性能优化——浅谈 memo 这一文中，我们详细介绍了 PureComponent 的定义以及内部实现机制，因此我们此处利用
PureComponent 组件来减少重复渲染。

实际验证结果如下图所示，优化后的 App 组件不再产生重复渲染。但这个有个细节问题，可能大家平时并未想过，如下：

> 我们利用 PureComponent 减少了 App 组件的重复渲染，那么 App 组件的 state 是否产生变化，即引用地址依旧是上次的地址吗？

经验证发现，虽然 PureComponent 减少了 App 组件的重复渲染，但是 App 组件的 state 的引用地址却发生了变化，这是为什么呢？

下面结合 React V16.9.0 源码，浅谈下 setState 的更新机制。以下对源码存在部分删减，方便更快理解源码。

是依旧会发生重复渲染，详见[样例展示](https://bian2017.github.io/performance-optimization-react/UselessRenderSameState.html)。

## 三、入队列

![]()

结合上图

### 3.1 setState 函数定义

以下代码摘自 `ReactBaseClasses.js`文件。

```JS
Component.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

从上述代码我们可以看出，setState 包含两个参数 partialState 和 callback，其中 partialState 表示我们修改的部分状态 state，callback 则是函数回调。

### 3.2 enqueueSetState 函数定义

代码摘自 React v16.9.0 中的 `ReactFiberClassComponent.js`文件。

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

  // 创建了一个新的对象
  const update = createUpdate(expirationTime, suspenseConfig);
  // payload存放的是要更新的状态，即partialState
  update.payload = payload;

  // 如果存在函数回调，则callback挂载在update对象上
  if (callback !== undefined && callback !== null) {
    update.callback = callback;
  }

  if (revertPassiveEffectsChange) {
    flushPassiveEffects();
  }
  // 添加到更新队列中
  enqueueUpdate(fiber, update);
  // 调度任务
  scheduleWork(fiber, expirationTime);
},
```

enqueueSetState 函数会创建一个 update 对象，该对象会挂载要变化的 partialState、函数回调、渲染的过去时间。然后加 update 对象添加到更新队列中，并且产生一个调度任务。

如果在 render 函数之前多次调用了 setState，则会产生多个 update 对象，并依次添加到更新到更新队列中，并产生多个调度任务。

### 3.3 createUpdate 函数定义

以下代码摘自 `ReactUpdateQueue.js`文件。

```ts
export function createUpdate(
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
): Update<*> {
  let update: Update<*> = {
    expirationTime,
    suspenseConfig,

    // 添加标识位，表示当前操作是UpdateState
    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
    nextEffect: null,
  };

  return update;
}
```

createUpdate 创建了一个新的 update 对象。

## 四、调度任务

每次调用`enqueueSetState`函数，都会创建一个调度任务。然后过经过一系列调度，最终会调起 updateClassComponent 组件。

调度不是我们这次的讨论重点，所以我们先暂时跳过。后续有空再研究下，挖坑代填。

### 4.1 beginWork 函数

```JS
  switch (workInProgress.tag) {
    // ...省略...
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    // ...省略...
```

### 4.3 updateClassInstance 函数

更新组件实例

```JS
// Invokes the update life-cycles and returns false if it shouldn't rerender.
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime,
): boolean {
  const instance = workInProgress.stateNode;

  const oldProps = workInProgress.memoizedProps;
  instance.props =
    workInProgress.type === workInProgress.elementType
      ? oldProps
      : resolveDefaultProps(workInProgress.type, oldProps);

  // ...省略...

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  let updateQueue = workInProgress.updateQueue;

  /**
   * 每次调用setState，都会将要改变的状态添加到updateQueue更新队列中。
   * 如果render之前多次调用setState，则会往updateQueue添加多条更新。
   */
  if (updateQueue !== null) {
    // 处理更新队列，将更新后的state存储在workInProgress中
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
   * 判断当前组件是否要进行渲染
   *
   * shouldUpdate值主要取决于shouldComponentUpdate生命周期执行结果，
   * 亦或者PureComponent的浅比较结果
   */
  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext,
    );


  if (shouldUpdate) {
    /**
     * ...省略...
     *
     * 此处执行相应的生命周期函数钩子
     */
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Snapshot;
      }
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  /**
   * 不管shouldUpdate的值是true还是false，都更新当前组件实例的props和state 的值，即更新引用地址。
   *
   * 这里有个重要的知识点，要注意！！！！
   * 即使我们采用PureComponent来减少无用渲染，但是该组件的state或者props依旧发生了变化。
   */
  instance.props = newProps;
  instance.state = newState;

  return shouldUpdate;
}

```

### 4.4 processUpdateQueue 函数

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

在组件 render 之前，我们通常会多次调用`setState`，每次调用`setState`都会产生一个 update 对象。这些 update 对象以链表的形式存在队列 queue 中。

`processUpdateQueue`函数主要功能是对更新队列进行依次遍历，并算出最终的 state，将其存储在`workInProgress.memoizedState`中。

### 4.5 getStateFromUpdate 函数

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

## 五、小结

每次调用 setState，都会创建一个全新的 state，并引起组件的重新渲染。即使使用`PureComponent`进行性能优化，组件的 state 的引用地址依旧产生了变化。
