
## Vue.js 3.0 响应式系统的实现原理

- reactive
    - 接收一个参数， 判断是否是对象
    - 创建拦截器对象handler，设置get/set/deleteProperty
        - get 中调用track收集依赖
        - set/deleteProperty 中调用trigger触发更新
    - 返回Proxy对象
- effect
    - effect函数接收一个函数
    - effect首先在全局缓存接收到的参数callback
    - 执行callback函数，在这个函数中由于读取了响应式数据，会触发handler中get中的track函数，收集依赖
    - 依赖收集完成后，清除全局缓存的callback引用
- track
    - track 函数用于收集依赖，接收响应式对象和属性名
    - 在上方的effect中，在全局缓存了一个activeEffect,方便track能访问，当执行到callback()时，会访问相应对象的属性，相应对象handler方法的get方法中会首先调用track收集依赖。track方法只在activeEffect有值时继续执行，所以在effect调用时访问响应式属性才会真正进入track方法收集依赖。也就是effect方法调用时的回调函数第一次执行时才会收集依赖
    - track函数外部会声明一个targetMap,用于保存响应式对象的所有被依赖属性和回调函数的集合。targetMap 结构实例  {target:{key1: [cb1, cb2](Set), key2: [cb](Set)}(Map)}(WeakMap)
- trigger
    - trigger函数用于触发更新，接收响应式对象和属性名
    - 通过响应式对象和属性名从targetMap取出所有的回调函数。依次执行处罚更新
- ref
    - ref 用于将一个变量处理成响应式，可以用于处理基础数据类型或者对象
    - 返回一个带有__v_isRef标识的对象，并将参数处理成响应式（如果是基本数据类型直接保存到value中）保存到返回对象的value中，value通过getter/setter拦截。
- toRefs
    - toRefs 接收一个 reactive返回的响应式对象，将该对象的所有属性通过ref函数处理返回，并返回一个包装对象
    - 通过这种方式返回的对象，解构之后仍然是响应式
    - 其实就是利用了结构赋值时引用传递的原理
- computed
    - computed 是effect包装，接收一个函数getter， 返回一个响应式的对象（计算属性）
    - 内部调用effect，收集依赖，当依赖的响应式对象改变时，会触发getter修改返回的响应式对象的值
