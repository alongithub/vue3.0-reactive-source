const isObject = val => val !== null && typeof val === 'object';

// 用于判断目标是否是对象，是对象进行代理
const convert = target => isObject(target) ? reactive(target) : target;

// 判断对象本身是否有目标属性
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (target, key) => hasOwnProperty.call(target, key);

/**
 * reactive函数接收target参数，将其代理成响应式对象并返回响应式对象
 * reactive只能处理对象和数组，不能处理原始数据类型
 */ 
export function reactive (target) {
    if (!isObject(target)) return target;

    const handler = {
        get(target, key, receiver) {
            // 收集依赖
            track(target, key);

            const result = Reflect.get(target, key, receiver)
            // 如果是对象，代理然后返回
            // 在访问的时候才会对深层的对象进行代理，惰性代理，提升性能
            return convert(result);
        },
        set(target, key, value, receiver) {
            const oldValue = Reflect.get(target, key, receiver);
            // 默认返回true，oldvalue等于value时返回true，但不触发更新
            let result = true;

            if (oldValue !== value) {
                result = Reflect.set(target, key, value, receiver);

                // 触发更新
                trigger(target, key);
            }

            return result;
        },
        deleteProperty(target, key) {
            const haskey = hasOwn(target, key);
            const result = Reflect.deleteProperty(target, key);
            if (haskey && result) {
                // 触发更新
                trigger(target, key);
            }
            return result;
        }
    }

    return new Proxy(target, handler);
}

/**
 * effect函数接收一个函数，这个函数会在第一次和依赖的响应式对象发生变化时执行
 */ 
let activeEffect = null;
export function effect(callback) {
    activeEffect = callback;
    callback(); // callback会收集响应式对象属性，此时可以来收集依赖
    activeEffect = null;
} 

/**
 * track 函数用于收集依赖
 * 在上方的effect中，在全局缓存了一个activeEffect,方便track能访问
 * 当执行到callback()时，会访问相应对象的属性，相应对象handler方法的get方法中会首先调用track收集依赖。
 * track方法只在activeEffect有值时继续执行，所以在effect调用时访问响应式属性才会真正进入track方法收集依赖。也就是effect方法调用时的回调函数第一次执行时才会收集依赖
 * track函数外部会声明一个targetMap,用户保存响应式对象的所有被依赖属性和回调函数的集合。targetMap 结构实例  {target:{key1: [cb1, cb2](Set), key2: [cb](Set)}(Map)}(WeakMap)
 */ 
let targetMap = new WeakMap();
export function track(target, key) {
    if (!activeEffect) return;
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()))
    }
    dep.add(activeEffect);
}

/**
 * trigger函数用于触发更新,查找这个属性是否有对应的回调函数
 */ 
export function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap) return;
    const dep = depsMap.get(key);
    if (dep) {
        dep.forEach(effect => {
            effect()
        })
    }
}

/**
 * ref 用于将一个变量处理成响应式，可以用于处理基础数据类型或者对象
 * 最终返回一个对象r，如果r的value在effct中被访问，会注册依赖
 * 同样，r的value被修改时，也会触发回调
 * 
 * ref可以把基本数据类型数据转换成响应式数据，可以通过value属性访问，模板中使用可以省略.value
 * ref返回的对象，重新复制成对象也是响应式的
 * reactive返回的的对象，重新复制丢失响应式
 * reactive返回的对象不可以解构
 */
export function ref(raw) {
    // 判断是否是ref创建的对象，是直接返回
    if (isObject(raw) && raw.__v_isRef) return;

    // 判断是否是对象，是的话转换成响应式对象，否则返回raw
    let value = convert(raw);
    const r = {
        __v_isRef: true,
        get value() {
            track(r, 'value');
            return value;
        },
        set value(newValue) {
            if (newValue !== value) {
                raw = newValue;
                value = convert(raw);
                trigger(r, 'value')
            }
        }
    }
    return r;
}

/**
 * toRefs 接收一个 reactive返回的响应式对象，将该对象的所有属性处理成ref
 * 返回的格式（将值包装到value中），并返回一个包装对象，
 * 通过这种方式返回的对象，解构之后仍然是响应式
 * 其实就是利用了赋值时引用传递的原理
 */ 
export function toRefs(proxy) {
    const ret = proxy instanceof Array ? new Array(proxy.length) : {};

    for (const key in proxy) {
        ret[key] = toProxyRef(proxy, key);
    }

    return ret;
}

// toRefs 内部调用的函数，用于将一个响应式的属性值处理成响应式
function toProxyRef (proxy, key) {
    const r = {
        __v_isRef: true,
        get value() {
            return proxy[key];
        },
        set value(newValue) {
            proxy[key] = newValue
        }
    }
    return r;
}

/**
 * computed 是effect包装，返回一个响应式的对象（计算属性）
 * 当依赖数据改变时，会修改返回的响应式对象的值
 */
export function computed (getter) {
    const result = ref(); // 创建一个空的ref，不在effectn内部创建为了保持对象是同一引用

    effect(() => {
        result.value = getter();
    })

    return result;
}