import React, { Component } from 'react';

let cnt = 0;

class ChildClass extends Component {
  render() {
    cnt = cnt + 1;

    return <p>Class组件发生渲染次数: {cnt}</p>;
  }
}

export default ChildClass;
