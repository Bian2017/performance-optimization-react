## React 性能优化

### 一、memo 和 PureComponent 组件

**场景一：**

[样例](https://bian2017.github.io/performance-optimization-react/UselessRenderSameState.html)

[代码]()

**场景二：**

场景二：给组件的 state 设置相同的值，此时组件的 state 并未发生变化，但组件依旧发生渲染

[样例](https://bian2017.github.io/performance-optimization-react/UselessRenderParent.html)

[代码]()
