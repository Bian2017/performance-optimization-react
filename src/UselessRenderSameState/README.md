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

### 4.4 processUpdateQueue

处理更新队列

```JS

export function processUpdateQueue<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  props: any,
  instance: any,
  renderExpirationTime: ExpirationTime,
): void {
  hasForceUpdate = false;

  queue = ensureWorkInProgressQueueIsAClone(workInProgress, queue);

  // These values may change as we process the queue.
  let newBaseState = queue.baseState;
  let newFirstUpdate = null;
  let newExpirationTime = NoWork;

  // Iterate through the list of updates to compute the result.
  let update = queue.firstUpdate;
  let resultState = newBaseState;

  /**
   * 对更新列表进行迭代，计算出新的结果
   * 假设我们在render之前多次调用了setState，此时会依次循环，产生一个最终的state
   */
  while (update !== null) {
    const updateExpirationTime = update.expirationTime;
    if (updateExpirationTime < renderExpirationTime) {
      // This update does not have sufficient priority. Skip it.
      if (newFirstUpdate === null) {
        // This is the first skipped update. It will be the first update in
        // the new list.
        newFirstUpdate = update;
        // Since this is the first update that was skipped, the current result
        // is the new base state.
        newBaseState = resultState;
      }
      // Since this update will remain in the list, update the remaining
      // expiration time.
      if (newExpirationTime < updateExpirationTime) {
        newExpirationTime = updateExpirationTime;
      }
    } else {
      // This update does have sufficient priority.

      // Mark the event time of this update as relevant to this render pass.
      // TODO: This should ideally use the true event time of this update rather than
      // its priority which is a derived and not reverseable value.
      // TODO: We should skip this update if it was already committed but currently
      // we have no way of detecting the difference between a committed and suspended
      // update here.
      markRenderEventTimeAndConfig(updateExpirationTime, update.suspenseConfig);

      // Process it and compute a new result.
      resultState = getStateFromUpdate(
        workInProgress,
        queue,
        update,
        resultState,
        props,
        instance,
      );
      const callback = update.callback;
      if (callback !== null) {
        workInProgress.effectTag |= Callback;
        // Set this to null, in case it was mutated during an aborted render.
        update.nextEffect = null;
        if (queue.lastEffect === null) {
          queue.firstEffect = queue.lastEffect = update;
        } else {
          queue.lastEffect.nextEffect = update;
          queue.lastEffect = update;
        }
      }
    }
    // Continue to the next update.
    update = update.next;
  }

  // Separately, iterate though the list of captured updates.
  let newFirstCapturedUpdate = null;
  update = queue.firstCapturedUpdate;
  while (update !== null) {
    const updateExpirationTime = update.expirationTime;
    if (updateExpirationTime < renderExpirationTime) {
      // This update does not have sufficient priority. Skip it.
      if (newFirstCapturedUpdate === null) {
        // This is the first skipped captured update. It will be the first
        // update in the new list.
        newFirstCapturedUpdate = update;
        // If this is the first update that was skipped, the current result is
        // the new base state.
        if (newFirstUpdate === null) {
          newBaseState = resultState;
        }
      }
      // Since this update will remain in the list, update the remaining
      // expiration time.
      if (newExpirationTime < updateExpirationTime) {
        newExpirationTime = updateExpirationTime;
      }
    } else {
      // This update does have sufficient priority. Process it and compute
      // a new result.
      resultState = getStateFromUpdate(
        workInProgress,
        queue,
        update,
        resultState,
        props,
        instance,
      );
      const callback = update.callback;
      if (callback !== null) {
        workInProgress.effectTag |= Callback;
        // Set this to null, in case it was mutated during an aborted render.
        update.nextEffect = null;
        if (queue.lastCapturedEffect === null) {
          queue.firstCapturedEffect = queue.lastCapturedEffect = update;
        } else {
          queue.lastCapturedEffect.nextEffect = update;
          queue.lastCapturedEffect = update;
        }
      }
    }
    update = update.next;
  }

  if (newFirstUpdate === null) {
    queue.lastUpdate = null;
  }
  if (newFirstCapturedUpdate === null) {
    queue.lastCapturedUpdate = null;
  } else {
    workInProgress.effectTag |= Callback;
  }
  if (newFirstUpdate === null && newFirstCapturedUpdate === null) {
    // We processed every update, without skipping. That means the new base
    // state is the same as the result state.
    newBaseState = resultState;
  }

  queue.baseState = newBaseState;
  queue.firstUpdate = newFirstUpdate;
  queue.firstCapturedUpdate = newFirstCapturedUpdate;

  // Set the remaining expiration time to be whatever is remaining in the queue.
  // This should be fine because the only two other things that contribute to
  // expiration time are props and context. We're already in the middle of the
  // begin phase by the time we start processing the queue, so we've already
  // dealt with the props. Context in components that specify
  // shouldComponentUpdate is tricky; but we'll have to account for
  // that regardless.
  workInProgress.expirationTime = newExpirationTime;

  // 将处理后的resultState更新到workInProgess上
  workInProgress.memoizedState = resultState;
}
```

### 4.5 getStateFromUpdate 函数

以下代码摘自 `ReactUpdateQueue.js`文件。

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

    // Intentional fallthrough
    case UpdateState: {
      const payload = update.payload;
      let partialState;
      if (typeof payload === 'function') {
        partialState = payload.call(instance, prevState, nextProps);
      } else {
        // Partial state object
        partialState = payload;
      }

      if (partialState === null || partialState === undefined) {
        // Null and undefined are treated as no-ops.
        return prevState;
      }

      // Merge the partial state and the previous state.

      // 此处重新生成一个新的状态state， 注意引用地址发生变化
      return Object.assign({}, prevState, partialState);
    }
    // .... 省略 ....
  }
  return prevState;
}
```

每次调用 setState，React 会通过 Object.assign 生成一个新的对象(注：此时 state 的引用地址产生了变化)，然后重新执行渲染逻辑。

因此进行性能优化的时候，不能简单以为值未发生变化，就直接比较 this.state 与 nextState。

注意，此处使用 Object.assign 做了一个对象的合并，Object.assign 第一个参数是空对象，也就是说新的 state 对象的引用地址发生了变化。
