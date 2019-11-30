import React from 'react';

let cnt = 0;

const ChildFunc = () => {
  cnt = cnt + 1;

  return <p>函数组件发生渲染次数: {cnt}</p>;
};

export default ChildFunc;
