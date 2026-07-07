import { instanceEventContexts, hConsole } from './core.js';

// AUMENTO MASIVO PARA ESTRÉS INDUSTRIAL (Zero-GC Maintained)
const INITIAL_CAPACITY = 999999;
const EXPANSION_FACTOR = 2;

let MAX_SIGNALS = INITIAL_CAPACITY;
let MAX_SUBSCRIBERS = INITIAL_CAPACITY;

const SCHEDULER_CAPACITY = 131072; 
const SCHEDULER_MASK = 131071;

export const SINK_TYPE_TEXT = 1;
export const SINK_TYPE_SHOW = 2;
export const SINK_TYPE_IF = 3;
export const SINK_TYPE_EACH = 4;
export const SINK_TYPE_STYLE = 5; 
export const SINK_TYPE_COMPUTED = 6;
export const SINK_TYPE_SYNC = 7;
export const SINK_TYPE_STYLE_OBJECT = 8;
export const SINK_TYPE_CLASS_OBJECT = 9;
export const SINK_TYPE_PROPERTY = 11;

export let signalValues = new Array(MAX_SIGNALS);
export let subscriberHead = new Int32Array(MAX_SIGNALS).fill(-1);
export let subscriberNext = new Int32Array(MAX_SUBSCRIBERS).fill(-1);
export let subscriberSinks = new Int32Array(MAX_SUBSCRIBERS).fill(-1);
export let subscriberPrev = new Int32Array(MAX_SUBSCRIBERS).fill(-1);
export let sinkTypes = new Uint8Array(MAX_SUBSCRIBERS);
export let sinkTargets = new Array(MAX_SUBSCRIBERS);
export let sinkMeta = new Array(MAX_SUBSCRIBERS);
export let sinkComponentIds = new Array(MAX_SUBSCRIBERS);
export let signalOwners = new Array(MAX_SIGNALS).fill(null);
export let signalNextOwned = new Int32Array(MAX_SIGNALS).fill(-1);
export let sinkNextOwned = new Int32Array(MAX_SUBSCRIBERS).fill(-1);
export const ownerFirstSignal = new Map();
export const ownerFirstSink = new Map();

export let computedRuntimes = new Array(MAX_SIGNALS).fill(null);
let activeComputedID = -1;
let isTrackingComputed = false;

// Expansión de pools (sin cambios, ya es robusta)
function expandSignalPool() {
    const oldCapacity = MAX_SIGNALS;
    const newCapacity = oldCapacity * EXPANSION_FACTOR;
    hConsole(() => console.warn(`[Hannah] Expandiendo pool de señales: ${oldCapacity} -> ${newCapacity}`));
    const newSignalValues = signalValues.slice();
    const newSubscriberHead = new Int32Array(newCapacity);
    newSubscriberHead.set(subscriberHead);
    const newSignalOwners = signalOwners.slice();
    const newComputedRuntimes = computedRuntimes.slice();
    newSignalValues.length = newCapacity;
    newSignalOwners.length = newCapacity;
    newComputedRuntimes.length = newCapacity;
    const newSignalNextOwned = new Int32Array(newCapacity);
    newSignalNextOwned.set(signalNextOwned);
    signalValues = newSignalValues;
    subscriberHead = newSubscriberHead;
    signalOwners = newSignalOwners;
    computedRuntimes = newComputedRuntimes;
    signalNextOwned = newSignalNextOwned;
    MAX_SIGNALS = newCapacity;
}

function expandSubscriberPool() {
    const oldCapacity = MAX_SUBSCRIBERS;
    const newCapacity = oldCapacity * EXPANSION_FACTOR;
    hConsole(() => console.warn(`[Hannah] Expandiendo pool de suscriptores: ${oldCapacity} -> ${newCapacity}`));
    const newSubscriberNext = new Int32Array(newCapacity);
    newSubscriberNext.set(subscriberNext);
    const newSubscriberSinks = new Int32Array(newCapacity);
    newSubscriberSinks.set(subscriberSinks);
    const newSubscriberPrev = new Int32Array(newCapacity);
    newSubscriberPrev.set(subscriberPrev);
    const newSinkTypes = new Uint8Array(newCapacity);
    newSinkTypes.set(sinkTypes);
    const newSinkTargets = sinkTargets.slice();
    newSinkTargets.length = newCapacity;
    const newSinkMeta = sinkMeta.slice();
    newSinkMeta.length = newCapacity;
    const newSinkComponentIds = sinkComponentIds.slice();
    newSinkComponentIds.length = newCapacity;
    const newSinkNextOwned = new Int32Array(newCapacity);
    newSinkNextOwned.set(sinkNextOwned);
    const newScheduledSinksMask = new Uint8Array(newCapacity);
    newScheduledSinksMask.set(scheduledSinksMask);
    subscriberNext = newSubscriberNext;
    subscriberSinks = newSubscriberSinks;
    subscriberPrev = newSubscriberPrev;
    sinkTypes = newSinkTypes;
    sinkTargets = newSinkTargets;
    sinkMeta = newSinkMeta;
    sinkComponentIds = newSinkComponentIds;
    sinkNextOwned = newSinkNextOwned;
    scheduledSinksMask = newScheduledSinksMask;
    MAX_SUBSCRIBERS = newCapacity;
}

let signalCounter = 0;
let subscriberCounter = 0;

const schedulerQueue = new Int32Array(SCHEDULER_CAPACITY);
let scheduledSinksMask = new Uint8Array(MAX_SUBSCRIBERS);
let queueHead = 0;
let queueTail = 0;
let isHostCallbackScheduled = false;

let currentOwnerId = null;
const listInstancesCache = new Map();

export function setCurrentOwner(instanceId) {
    currentOwnerId = instanceId;
}

function queueSink(sinkID) {
    if (scheduledSinksMask[sinkID] === 1) return;
    schedulerQueue[queueTail] = sinkID;
    queueTail = (queueTail + 1) & SCHEDULER_MASK; 
    scheduledSinksMask[sinkID] = 1;
    if (!isHostCallbackScheduled) {
        isHostCallbackScheduled = true;
        queueMicrotask(flushQueue);
    }
}

function flushQueue() {
    isHostCallbackScheduled = false;
    while (queueHead !== queueTail) {
        const sinkID = schedulerQueue[queueHead];
        queueHead = (queueHead + 1) & SCHEDULER_MASK;
        scheduledSinksMask[sinkID] = 0;
        applySink(sinkID);
    }
}

export function createSignal(initialValue) {
    try {
        if (signalCounter >= MAX_SIGNALS * 0.9) expandSignalPool();
        let id = signalCounter++;
        signalValues[id] = initialValue;
        subscriberHead[id] = -1;
        signalOwners[id] = currentOwnerId;
        computedRuntimes[id] = null;
        if (currentOwnerId) {
            signalNextOwned[id] = ownerFirstSignal.has(currentOwnerId) ? ownerFirstSignal.get(currentOwnerId) : -1;
            ownerFirstSignal.set(currentOwnerId, id);
        } else {
            signalNextOwned[id] = -1;
        }
        return id;
    } catch (e) {
        hConsole(() => console.error('[Hannah] Error creando señal:', e));
        expandSignalPool();
        let id = signalCounter++;
        signalValues[id] = initialValue;
        subscriberHead[id] = -1;
        signalOwners[id] = currentOwnerId;
        computedRuntimes[id] = null;
        if (currentOwnerId) {
            signalNextOwned[id] = ownerFirstSignal.has(currentOwnerId) ? ownerFirstSignal.get(currentOwnerId) : -1;
            ownerFirstSignal.set(currentOwnerId, id);
        } else {
            signalNextOwned[id] = -1;
        }
        return id;
    }
}

export function createComputed(fn) {
    if (signalCounter >= MAX_SIGNALS * 0.9) expandSignalPool();
    let computedID = signalCounter++;
    signalValues[computedID] = undefined;
    subscriberHead[computedID] = -1;
    signalOwners[computedID] = currentOwnerId;
    computedRuntimes[computedID] = fn;
    isTrackingComputed = true;
    evaluateComputed(computedID);
    isTrackingComputed = false;
    if (currentOwnerId) {
        signalNextOwned[computedID] = ownerFirstSignal.has(currentOwnerId) ? ownerFirstSignal.get(currentOwnerId) : -1;
        ownerFirstSignal.set(currentOwnerId, computedID);
    } else {
        signalNextOwned[computedID] = -1;
    }
    return computedID;
}

function evaluateComputed(computedID) {
    const fn = computedRuntimes[computedID];
    if (!fn) return;
    const previousComputed = activeComputedID;
    activeComputedID = computedID;
    try {
        const newValue = fn();
        writeSignal(computedID, newValue);
    } finally {
        activeComputedID = previousComputed;
    }
}

export function readSignal(id) {
    if (isTrackingComputed && activeComputedID !== -1) {
        let curr = subscriberHead[id];
        let found = false;
        while(curr !== -1) {
            if (sinkTypes[curr] === SINK_TYPE_COMPUTED && sinkTargets[curr] === activeComputedID) {
                found = true; 
                break;
            }
            curr = subscriberNext[curr];
        }
        if (!found) {
            if (subscriberCounter >= MAX_SUBSCRIBERS * 0.9) expandSubscriberPool();
            let sinkID = subscriberCounter++;
            sinkTypes[sinkID] = SINK_TYPE_COMPUTED;
            sinkTargets[sinkID] = activeComputedID;
            subscriberSinks[sinkID] = id;
            sinkComponentIds[sinkID] = signalOwners[activeComputedID];
            const currentHead = subscriberHead[id];
            subscriberNext[sinkID] = currentHead;
            subscriberPrev[sinkID] = -1;
            if (currentHead !== -1) subscriberPrev[currentHead] = sinkID;
            subscriberHead[id] = sinkID;
        }
    }
    return signalValues[id];
}

export function writeSignal(id, newValue) {
    if (signalValues[id] === newValue) return;
    signalValues[id] = newValue;
    hConsole(() => console.log(`[writeSignal] ID: ${id}, Nuevo valor: `, newValue));
    let currentSub = subscriberHead[id];
    while (currentSub !== -1 && currentSub !== undefined) {
        queueSink(currentSub);
        currentSub = subscriberNext[currentSub];
    }
}

export function registerSink(element, type, signalID, instanceId, meta = null) {
    if (subscriberCounter >= MAX_SUBSCRIBERS * 0.9) expandSubscriberPool();
    let sinkID = subscriberCounter++;
    sinkTypes[sinkID] = type;
    sinkTargets[sinkID] = element;
    subscriberSinks[sinkID] = signalID;
    sinkComponentIds[sinkID] = instanceId;

    if (type === SINK_TYPE_IF) {
        let anchorNode = meta;
        if (!anchorNode || anchorNode.nodeType !== 8) {
            anchorNode = document.createComment('h-if-anchor');
            if (element.parentNode) {
                element.parentNode.insertBefore(anchorNode, element);
            } else {
                console.warn('[Hannah] Elemento sin parentNode al registrar h-if');
            }
        }
        const fragment = document.createDocumentFragment();
        element.parentNode.removeChild(element);
        fragment.appendChild(element);
        sinkMeta[sinkID] = {
            anchor: anchorNode,
            fragment: fragment,
            currentElement: element
        };
        if (anchorNode.parentNode) {
            anchorNode.parentNode.insertBefore(anchorNode, anchorNode.nextSibling);
        }
    } else {
        sinkMeta[sinkID] = meta;
    }

    if (type === SINK_TYPE_SYNC) {
        hConsole(() => console.log('[registerSink] SYNC', { element, signalID, instanceId, meta }));
    }
    if (type === SINK_TYPE_TEXT) {
        hConsole(() => console.log('[registerSink TEXT]', { element, signalID, instanceId }));
    }

    const currentHead = subscriberHead[signalID];
    subscriberNext[sinkID] = currentHead;
    subscriberPrev[sinkID] = -1;
    if (currentHead !== -1) subscriberPrev[currentHead] = sinkID;
    subscriberHead[signalID] = sinkID;

    const ownerId = instanceId;
    if (ownerId) {
        sinkNextOwned[sinkID] = ownerFirstSink.has(ownerId) ? ownerFirstSink.get(ownerId) : -1;
        ownerFirstSink.set(ownerId, sinkID);
    } else {
        sinkNextOwned[sinkID] = -1;
    }

    applySink(sinkID);
    return sinkID;
}

function createLocalContext(itemName, itemData, childInstanceId, parentContext = null) {
    const localContext = {};
    setCurrentOwner(childInstanceId);

    const target = {};
    const signalMap = {};

    for (const key in itemData) {
        const signalID = createSignal(itemData[key]);
        target[key] = signalID;
        localContext[`${itemName}.${key}`] = signalID;
        signalMap[`${itemName}.${key}`] = signalID;
    }

    const itemProxy = new Proxy(target, {
        get(t, prop) {
            const signalID = t[prop];
            if (signalID !== undefined) {
                return readSignal(signalID);
            }
            return undefined;
        },
        set(t, prop, value) {
            const signalID = t[prop];
            if (signalID !== undefined) {
                writeSignal(signalID, value);
                return true;
            }
            // Si la propiedad no existe, la creamos como señal
            const newSignalID = createSignal(value);
            t[prop] = newSignalID;
            localContext[`${itemName}.${prop}`] = newSignalID;
            signalMap[`${itemName}.${prop}`] = newSignalID;
            return true;
        }
    });

    localContext[itemName] = itemProxy;
    localContext['item'] = itemProxy;

    if (parentContext) {
        for (const key in parentContext) {
            if (!(key in localContext) && key !== '__signalMap') {
                localContext[key] = parentContext[key];
            }
        }
    }

    // if (target.completed !== undefined) {
    //     const completedID = target.completed;
    //     const classObjComputed = createComputed(() => {
    //         const completed = readSignal(completedID);
    //         return { completed: completed };
    //     });
    //     localContext['classObj'] = classObjComputed;
    //     signalMap['classObj'] = classObjComputed;
    // }

    localContext.__signalMap = signalMap;

    setCurrentOwner(null);
    return localContext;
}

function updateLocalContext(localContext, itemName, newItemData) {
    for (const key in newItemData) {
        const signalID = localContext[`${itemName}.${key}`];
        if (signalID !== undefined) {
            writeSignal(signalID, newItemData[key]);
        }
    }
    const itemObj = localContext[itemName];
    if (itemObj) {
        for (const key in newItemData) {
            itemObj[key] = newItemData[key];
        }
    }
}

// Funciones LIS (sin cambios)
function calculateFlatHashCode(key) {
    if (typeof key === 'number') return key & 0x7fffffff;
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; 
    }
    return hash & 0x7fffffff;
}

function getFlatSequence(sourceArray, length) {
    const p = new Int32Array(length);
    const resultIndices = new Int32Array(length);
    let resultLen = 0;
    for (let i = 0; i < length; i++) {
        const val = sourceArray[i];
        if (val !== -1) {
            const j = resultLen > 0 ? resultIndices[resultLen - 1] : -1;
            if (j === -1 || sourceArray[j] < val) {
                p[i] = j;
                resultIndices[resultLen++] = i;
                continue;
            }
            let u = 0, v = resultLen - 1;
            while (u < v) {
                const c = (u + v) >> 1;
                if (sourceArray[resultIndices[c]] < val) u = c + 1;
                else v = c;
            }
            if (val < sourceArray[resultIndices[u]]) {
                if (u > 0) p[i] = resultIndices[u - 1];
                resultIndices[u] = i;
            }
        }
    }
    const result = new Int32Array(resultLen);
    let u = resultLen;
    let v = resultIndices[resultLen - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

function createComponentInstance(itemData, meta) {
    const fragment = meta.blueprint.cloneNode(true);
    const startNode = document.createComment('item-start');
    const endNode = document.createComment('item-end');
    fragment.insertBefore(startNode, fragment.firstChild);
    fragment.appendChild(endNode);

    const instanceId = `h-item-${Math.random().toString(36).substr(2, 9)}`;
    const localContext = createLocalContext(meta.itemName, itemData, instanceId);
    
    let eventContext = meta.eventContext;
    if (!eventContext && meta.parentInstanceId && typeof window !== 'undefined') {
        const contexts = window.__hannah_eventContexts;
        if (contexts) {
            eventContext = contexts.get(meta.parentInstanceId);
        }
    }

    meta.compilerFn(fragment, localContext, instanceId, false, eventContext);
    return { startNode, endNode, instanceId, localContext, fragment, key: itemData[meta.keyProp] };
}

function removeComponentInstance(instance) {
    cleanupComponentSinks(instance.instanceId);
    cleanupComponentSignals(instance.instanceId);
    let curr = instance.startNode;
    const end = instance.endNode.nextSibling;
    while (curr && curr !== end) {
        if (curr._hannah_listeners) {
            delete curr._hannah_listeners;
        }
        const next = curr.nextSibling;
        curr.remove();
        curr = next;
    }
}

function moveComponentDOM(instance, parent, nextSibling) {
    let curr = instance.startNode;
    const end = instance.endNode.nextSibling;
    while (curr && curr !== end) {
        const next = curr.nextSibling;
        parent.insertBefore(curr, nextSibling);
        curr = next;
    }
}

export function registerListSink(templateNode, arraySignalID, keyProp, itemName, parentInstanceId, compilerFn, eventContext = null) {
    const parent = templateNode.parentNode;
    const anchor = document.createComment(`h-each-anchor`);
    parent.insertBefore(anchor, templateNode);
    const blueprint = templateNode.content;
    templateNode.remove();

    listInstancesCache.set(anchor, []);

    let sinkID = subscriberCounter++;
    sinkTypes[sinkID] = SINK_TYPE_EACH;
    sinkTargets[sinkID] = anchor;
    subscriberSinks[sinkID] = arraySignalID;
    sinkComponentIds[sinkID] = parentInstanceId;
    sinkMeta[sinkID] = { blueprint, keyProp, itemName, parentInstanceId, compilerFn, sinkID, eventContext };

    const currentHead = subscriberHead[arraySignalID];
    subscriberNext[sinkID] = currentHead;
    subscriberPrev[sinkID] = -1;
    if (currentHead !== -1) subscriberPrev[currentHead] = sinkID;
    subscriberHead[arraySignalID] = sinkID;

    reconcileList(anchor, signalValues[arraySignalID], sinkMeta[sinkID]);

    const ownerId = parentInstanceId;
    if (ownerId) {
        sinkNextOwned[sinkID] = ownerFirstSink.has(ownerId) ? ownerFirstSink.get(ownerId) : -1;
        ownerFirstSink.set(ownerId, sinkID);
    } else {
        sinkNextOwned[sinkID] = -1;
    }
}

// export function reconcileList(anchor, newArray, meta) {
//     if (!newArray) newArray = [];
//     const parent = anchor.parentNode;
//     let oldInstances = listInstancesCache.get(anchor) || [];

//     const { keyProp, itemName, compilerFn, parentInstanceId } = meta;
//     let { eventContext } = meta;

//     if (!eventContext && parentInstanceId && typeof window !== 'undefined') {
//         const contexts = window.__hannah_eventContexts;
//         if (contexts) {
//             eventContext = contexts.get(parentInstanceId);
//         }
//     }

//     const oldLen = oldInstances.length;
//     const newLen = newArray.length;

//     let start = 0;
//     let oldEnd = oldLen - 1;
//     let newEnd = newLen - 1;

//     // Prefix scan
//     while (start <= oldEnd && start <= newEnd && oldInstances[start].key === newArray[start][keyProp]) {
//         updateLocalContext(oldInstances[start].localContext, itemName, newArray[start]);
//         start++;
//     }

//     // Suffix scan
//     while (start <= oldEnd && start <= newEnd && oldInstances[oldEnd].key === newArray[newEnd][keyProp]) {
//         updateLocalContext(oldInstances[oldEnd].localContext, itemName, newArray[newEnd]);
//         oldEnd--;
//         newEnd--;
//     }

//     // Fast paths
//     if (start > oldEnd) {
//         if (start <= newEnd) {
//             const nextSibling = (newEnd + 1 < newLen) ? oldInstances[start].startNode : anchor;
//             // 🔥 Usamos DocumentFragment para inserción masiva
//             const fragment = document.createDocumentFragment();
//             const newItems = [];
//             for (let i = start; i <= newEnd; i++) {
//                 const newInst = createComponentInstance(newArray[i], { ...meta, eventContext });
//                 newItems.push(newInst);
//                 fragment.appendChild(newInst.fragment);
//             }
//             oldInstances.splice(start, 0, ...newItems);
//             parent.insertBefore(fragment, nextSibling);
//         }
//         listInstancesCache.set(anchor, oldInstances);
//         return;
//     } else if (start > newEnd) {
//         while (start <= oldEnd) {
//             removeComponentInstance(oldInstances[start]);
//             oldInstances.splice(start, 1);
//             oldEnd--;
//         }
//         listInstancesCache.set(anchor, oldInstances);
//         return;
//     }

//     // Complex block (LIS)
//     const oldRemaining = oldEnd - start + 1;
//     const newRemaining = newEnd - start + 1;

//     const source = new Int32Array(newRemaining).fill(-1);
//     const hashSize = 1 << (32 - Math.clz32(newRemaining * 2));
//     const hashMask = hashSize - 1;
//     const hashTable = new Int32Array(hashSize).fill(-1);

//     for (let i = 0; i < newRemaining; i++) {
//         const newIdx = start + i;
//         const key = newArray[newIdx][keyProp];
//         let hash = calculateFlatHashCode(key) & hashMask;
//         while (hashTable[hash] !== -1) hash = (hash + 1) & hashMask;
//         hashTable[hash] = newIdx;
//     }

//     let moved = false;
//     let maxNewIndexSoFar = 0;
//     let patchedCount = 0;
//     const newInstances = new Array(newLen);

//     for (let i = 0; i < start; i++) newInstances[i] = oldInstances[i];
//     const suffixOffset = oldEnd - newEnd;
//     for (let i = newLen - 1; i > newEnd; i--) {
//         newInstances[i] = oldInstances[i + suffixOffset];
//     }

//     for (let i = 0; i < oldRemaining; i++) {
//         const oldIdx = start + i;
//         const oldInst = oldInstances[oldIdx];

//         if (patchedCount >= newRemaining) {
//             removeComponentInstance(oldInst);
//             continue;
//         }

//         const key = oldInst.key;
//         let hash = calculateFlatHashCode(key) & hashMask;
//         let newIdx = -1;
//         while (hashTable[hash] !== -1) {
//             const candidateIdx = hashTable[hash];
//             if (newArray[candidateIdx][keyProp] === key) {
//                 newIdx = candidateIdx;
//                 break;
//             }
//             hash = (hash + 1) & hashMask;
//         }

//         if (newIdx === -1) {
//             removeComponentInstance(oldInst);
//         } else {
//             source[newIdx - start] = oldIdx;
//             if (newIdx < maxNewIndexSoFar) moved = true;
//             else maxNewIndexSoFar = newIdx;

//             updateLocalContext(oldInst.localContext, itemName, newArray[newIdx]);
//             newInstances[newIdx] = oldInst;
//             patchedCount++;
//         }
//     }

//     const lisSequence = moved ? getFlatSequence(source, newRemaining) : null;
//     let lisPtr = lisSequence ? lisSequence.length - 1 : -1;

//     for (let i = newRemaining - 1; i >= 0; i--) {
//         const newIdx = start + i;
//         const oldIdx = source[i];
//         let nextSibling = anchor;
//         if (newIdx + 1 < newLen) {
//             const potentialSibling = newInstances[newIdx + 1]?.startNode;
//             if (potentialSibling && potentialSibling.parentNode === parent) {
//                 nextSibling = potentialSibling;
//             }
//         }

//         if (oldIdx === -1) {
//             const newInst = createComponentInstance(newArray[newIdx], { ...meta, eventContext });
//             newInstances[newIdx] = newInst;
//             parent.insertBefore(newInst.fragment, nextSibling);
//         } else if (moved) {
//             if (lisPtr < 0 || i !== lisSequence[lisPtr]) {
//                 moveComponentDOM(newInstances[newIdx], parent, nextSibling);
//             } else {
//                 lisPtr--;
//             }
//         }
//     }

//     oldInstances.length = newLen;
//     for (let i = 0; i < newLen; i++) {
//         oldInstances[i] = newInstances[i];
//     }

//     listInstancesCache.set(anchor, oldInstances);
// }
// Reemplazar la función reconcileList con esta versión que fuerza la recreación de DOM para items modificados
// export function reconcileList(anchor, newArray, meta) {
//     if (!newArray) newArray = [];
//     const parent = anchor.parentNode;
//     let oldInstances = listInstancesCache.get(anchor) || [];

//     const { keyProp, itemName, compilerFn, parentInstanceId } = meta;
//     let { eventContext } = meta;

//     if (!eventContext && parentInstanceId && typeof window !== 'undefined') {
//         const contexts = window.__hannah_eventContexts;
//         if (contexts) {
//             eventContext = contexts.get(parentInstanceId);
//         }
//     }

//     const oldLen = oldInstances.length;
//     const newLen = newArray.length;

//     let start = 0;
//     let oldEnd = oldLen - 1;
//     let newEnd = newLen - 1;

//     // Prefix scan: reutilizar instancias que no han cambiado
//     while (start <= oldEnd && start <= newEnd && oldInstances[start].key === newArray[start][keyProp]) {
//         // Si el item no ha cambiado (misma clave), solo actualizar contexto local
//         const oldData = oldInstances[start].localContext[itemName];
//         const newData = newArray[start];
//         // Actualizar todas las señales del contexto local con los nuevos datos
//         const signalMap = oldInstances[start].localContext.__signalMap;
//         for (const key in newData) {
//             const signalID = signalMap[`${itemName}.${key}`];
//             if (signalID !== undefined) {
//                 writeSignal(signalID, newData[key]);
//             }
//         }
//         // Actualizar el proxy
//         const proxy = oldInstances[start].localContext[itemName];
//         if (proxy) {
//             for (const key in newData) {
//                 proxy[key] = newData[key];
//             }
//         }
//         start++;
//     }

//     // Suffix scan: reutilizar instancias que no han cambiado
//     while (start <= oldEnd && start <= newEnd && oldInstances[oldEnd].key === newArray[newEnd][keyProp]) {
//         const oldData = oldInstances[oldEnd].localContext[itemName];
//         const newData = newArray[newEnd];
//         const signalMap = oldInstances[oldEnd].localContext.__signalMap;
//         for (const key in newData) {
//             const signalID = signalMap[`${itemName}.${key}`];
//             if (signalID !== undefined) {
//                 writeSignal(signalID, newData[key]);
//             }
//         }
//         const proxy = oldInstances[oldEnd].localContext[itemName];
//         if (proxy) {
//             for (const key in newData) {
//                 proxy[key] = newData[key];
//             }
//         }
//         oldEnd--;
//         newEnd--;
//     }

//     // Fast paths: insertar o eliminar
//     if (start > oldEnd) {
//         if (start <= newEnd) {
//             const nextSibling = (newEnd + 1 < newLen) ? oldInstances[start].startNode : anchor;
//             const fragment = document.createDocumentFragment();
//             const newItems = [];
//             for (let i = start; i <= newEnd; i++) {
//                 const newInst = createComponentInstance(newArray[i], { ...meta, eventContext });
//                 newItems.push(newInst);
//                 fragment.appendChild(newInst.fragment);
//             }
//             oldInstances.splice(start, 0, ...newItems);
//             parent.insertBefore(fragment, nextSibling);
//         }
//         listInstancesCache.set(anchor, oldInstances);
//         return;
//     } else if (start > newEnd) {
//         while (start <= oldEnd) {
//             removeComponentInstance(oldInstances[start]);
//             oldInstances.splice(start, 1);
//             oldEnd--;
//         }
//         listInstancesCache.set(anchor, oldInstances);
//         return;
//     }

//     // Complex block: los items que cambian (misma clave pero datos diferentes)
//     const oldRemaining = oldEnd - start + 1;
//     const newRemaining = newEnd - start + 1;

//     const source = new Int32Array(newRemaining).fill(-1);
//     const hashSize = 1 << (32 - Math.clz32(newRemaining * 2));
//     const hashMask = hashSize - 1;
//     const hashTable = new Int32Array(hashSize).fill(-1);

//     // Mapear claves nuevas a índices
//     for (let i = 0; i < newRemaining; i++) {
//         const newIdx = start + i;
//         const key = newArray[newIdx][keyProp];
//         let hash = calculateFlatHashCode(key) & hashMask;
//         while (hashTable[hash] !== -1) hash = (hash + 1) & hashMask;
//         hashTable[hash] = newIdx;
//     }

//     let moved = false;
//     let maxNewIndexSoFar = 0;
//     let patchedCount = 0;
//     const newInstances = new Array(newLen);

//     // Copiar prefijo y sufijo
//     for (let i = 0; i < start; i++) newInstances[i] = oldInstances[i];
//     const suffixOffset = oldEnd - newEnd;
//     for (let i = newLen - 1; i > newEnd; i--) {
//         newInstances[i] = oldInstances[i + suffixOffset];
//     }

//     // Procesar elementos en el rango
//     for (let i = 0; i < oldRemaining; i++) {
//         const oldIdx = start + i;
//         const oldInst = oldInstances[oldIdx];

//         if (patchedCount >= newRemaining) {
//             removeComponentInstance(oldInst);
//             continue;
//         }

//         const key = oldInst.key;
//         let hash = calculateFlatHashCode(key) & hashMask;
//         let newIdx = -1;
//         while (hashTable[hash] !== -1) {
//             const candidateIdx = hashTable[hash];
//             if (newArray[candidateIdx][keyProp] === key) {
//                 newIdx = candidateIdx;
//                 break;
//             }
//             hash = (hash + 1) & hashMask;
//         }

//         if (newIdx === -1) {
//             removeComponentInstance(oldInst);
//         } else {
//             source[newIdx - start] = oldIdx;
//             if (newIdx < maxNewIndexSoFar) moved = true;
//             else maxNewIndexSoFar = newIdx;

//             // 🔥 CRÍTICO: Si el item cambió, recreamos la instancia en lugar de solo actualizar
//             const oldData = oldInst.localContext[itemName];
//             const newData = newArray[newIdx];
//             // Verificar si los datos son diferentes (comparación superficial)
//             let hasChanged = false;
//             for (const key in newData) {
//                 if (oldData[key] !== newData[key]) {
//                     hasChanged = true;
//                     break;
//                 }
//             }
//             if (hasChanged) {
//                 // Recrear la instancia (esto regenera los sinks y listeners)
//                 const newInst = createComponentInstance(newArray[newIdx], { ...meta, eventContext });
//                 // Reemplazar el DOM del viejo item con el nuevo
//                 const parentNode = oldInst.startNode.parentNode;
//                 const nextSibling = oldInst.endNode.nextSibling;
//                 // Limpiar vieja instancia
//                 removeComponentInstance(oldInst);
//                 // Insertar nueva
//                 parentNode.insertBefore(newInst.fragment, nextSibling);
//                 newInstances[newIdx] = newInst;
//                 patchedCount++;
//             } else {
//                 // Si no cambió, reutilizar
//                 updateLocalContext(oldInst.localContext, itemName, newArray[newIdx]);
//                 newInstances[newIdx] = oldInst;
//                 patchedCount++;
//             }
//         }
//     }

//     // Movimiento basado en LIS (solo para items que no fueron recreados)
//     const lisSequence = moved ? getFlatSequence(source, newRemaining) : null;
//     let lisPtr = lisSequence ? lisSequence.length - 1 : -1;

//     for (let i = newRemaining - 1; i >= 0; i--) {
//         const newIdx = start + i;
//         const oldIdx = source[i];
//         let nextSibling = anchor;
//         if (newIdx + 1 < newLen) {
//             const potentialSibling = newInstances[newIdx + 1]?.startNode;
//             if (potentialSibling && potentialSibling.parentNode === parent) {
//                 nextSibling = potentialSibling;
//             }
//         }

//         if (oldIdx === -1) {
//             // Insertar nuevo (ya creado arriba)
//             const newInst = createComponentInstance(newArray[newIdx], { ...meta, eventContext });
//             newInstances[newIdx] = newInst;
//             parent.insertBefore(newInst.fragment, nextSibling);
//         } else if (moved) {
//             // Mover existente si no está en LIS
//             if (lisPtr < 0 || i !== lisSequence[lisPtr]) {
//                 moveComponentDOM(newInstances[newIdx], parent, nextSibling);
//             } else {
//                 lisPtr--;
//             }
//         }
//     }

//     oldInstances.length = newLen;
//     for (let i = 0; i < newLen; i++) {
//         oldInstances[i] = newInstances[i];
//     }

//     listInstancesCache.set(anchor, oldInstances);
// }
export function reconcileList(anchor, newArray, meta) {
    if (!newArray) newArray = [];
    const parent = anchor.parentNode;
    let oldInstances = listInstancesCache.get(anchor) || [];

    const { keyProp, itemName, compilerFn, parentInstanceId } = meta;
    let { eventContext } = meta;

    if (!eventContext && parentInstanceId && typeof window !== 'undefined') {
        const contexts = window.__hannah_eventContexts;
        if (contexts) {
            eventContext = contexts.get(parentInstanceId);
        }
    }

    const oldLen = oldInstances.length;
    const newLen = newArray.length;

    let start = 0;
    let oldEnd = oldLen - 1;
    let newEnd = newLen - 1;

    // Prefix scan
    while (start <= oldEnd && start <= newEnd && oldInstances[start].key === newArray[start][keyProp]) {
        // Actualizar el contexto local con los nuevos datos (incluyendo text)
        updateLocalContext(oldInstances[start].localContext, itemName, newArray[start]);
        start++;
    }

    // Suffix scan
    while (start <= oldEnd && start <= newEnd && oldInstances[oldEnd].key === newArray[newEnd][keyProp]) {
        updateLocalContext(oldInstances[oldEnd].localContext, itemName, newArray[newEnd]);
        oldEnd--;
        newEnd--;
    }

    // Fast paths
    if (start > oldEnd) {
        if (start <= newEnd) {
            const nextSibling = (newEnd + 1 < newLen) ? oldInstances[start].startNode : anchor;
            const fragment = document.createDocumentFragment();
            const newItems = [];
            for (let i = start; i <= newEnd; i++) {
                const newInst = createComponentInstance(newArray[i], { ...meta, eventContext });
                newItems.push(newInst);
                fragment.appendChild(newInst.fragment);
            }
            oldInstances.splice(start, 0, ...newItems);
            parent.insertBefore(fragment, nextSibling);
        }
        // 🔥 Actualizar todas las señales de todas las instancias (por si acaso)
        for (const inst of oldInstances) {
            const idx = oldInstances.indexOf(inst);
            if (idx < newArray.length) {
                updateLocalContext(inst.localContext, itemName, newArray[idx]);
            }
        }
        listInstancesCache.set(anchor, oldInstances);
        return;
    } else if (start > newEnd) {
        while (start <= oldEnd) {
            removeComponentInstance(oldInstances[start]);
            oldInstances.splice(start, 1);
            oldEnd--;
        }
        listInstancesCache.set(anchor, oldInstances);
        return;
    }

    // Complex block (LIS)
    const oldRemaining = oldEnd - start + 1;
    const newRemaining = newEnd - start + 1;

    const source = new Int32Array(newRemaining).fill(-1);
    const hashSize = 1 << (32 - Math.clz32(newRemaining * 2));
    const hashMask = hashSize - 1;
    const hashTable = new Int32Array(hashSize).fill(-1);

    for (let i = 0; i < newRemaining; i++) {
        const newIdx = start + i;
        const key = newArray[newIdx][keyProp];
        let hash = calculateFlatHashCode(key) & hashMask;
        while (hashTable[hash] !== -1) hash = (hash + 1) & hashMask;
        hashTable[hash] = newIdx;
    }

    let moved = false;
    let maxNewIndexSoFar = 0;
    let patchedCount = 0;
    const newInstances = new Array(newLen);

    for (let i = 0; i < start; i++) newInstances[i] = oldInstances[i];
    const suffixOffset = oldEnd - newEnd;
    for (let i = newLen - 1; i > newEnd; i--) {
        newInstances[i] = oldInstances[i + suffixOffset];
    }

    for (let i = 0; i < oldRemaining; i++) {
        const oldIdx = start + i;
        const oldInst = oldInstances[oldIdx];

        if (patchedCount >= newRemaining) {
            removeComponentInstance(oldInst);
            continue;
        }

        const key = oldInst.key;
        let hash = calculateFlatHashCode(key) & hashMask;
        let newIdx = -1;
        while (hashTable[hash] !== -1) {
            const candidateIdx = hashTable[hash];
            if (newArray[candidateIdx][keyProp] === key) {
                newIdx = candidateIdx;
                break;
            }
            hash = (hash + 1) & hashMask;
        }

        if (newIdx === -1) {
            removeComponentInstance(oldInst);
        } else {
            source[newIdx - start] = oldIdx;
            if (newIdx < maxNewIndexSoFar) moved = true;
            else maxNewIndexSoFar = newIdx;

            // 🔥 Siempre actualizar el contexto local con los nuevos datos
            updateLocalContext(oldInst.localContext, itemName, newArray[newIdx]);
            newInstances[newIdx] = oldInst;
            patchedCount++;
        }
    }

    const lisSequence = moved ? getFlatSequence(source, newRemaining) : null;
    let lisPtr = lisSequence ? lisSequence.length - 1 : -1;

    for (let i = newRemaining - 1; i >= 0; i--) {
        const newIdx = start + i;
        const oldIdx = source[i];
        let nextSibling = anchor;
        if (newIdx + 1 < newLen) {
            const potentialSibling = newInstances[newIdx + 1]?.startNode;
            if (potentialSibling && potentialSibling.parentNode === parent) {
                nextSibling = potentialSibling;
            }
        }

        if (oldIdx === -1) {
            const newInst = createComponentInstance(newArray[newIdx], { ...meta, eventContext });
            newInstances[newIdx] = newInst;
            parent.insertBefore(newInst.fragment, nextSibling);
        } else if (moved) {
            if (lisPtr < 0 || i !== lisSequence[lisPtr]) {
                moveComponentDOM(newInstances[newIdx], parent, nextSibling);
            } else {
                lisPtr--;
            }
        }
    }

    oldInstances.length = newLen;
    for (let i = 0; i < newLen; i++) {
        oldInstances[i] = newInstances[i];
    }

    // // 🔥 BARRIDO FINAL: Asegurar que todas las señales de todos los items estén actualizadas
    // for (let i = 0; i < newLen; i++) {
    //     const inst = oldInstances[i];
    //     const newData = newArray[i];
    //     // Si la instancia es nueva, ya tiene los datos correctos
    //     // Si es reutilizada, updateLocalContext ya se llamó, pero lo reforzamos
    //     updateLocalContext(inst.localContext, itemName, newData);
    // }

    listInstancesCache.set(anchor, oldInstances);
}

export function cleanupComponentSignals(instanceId) {
    let curr = ownerFirstSignal.has(instanceId) ? ownerFirstSignal.get(instanceId) : -1;
    while (curr !== -1) {
        const next = signalNextOwned[curr];
        if (sinkTypes[curr] === SINK_TYPE_EACH) {
            const anchor = sinkTargets[curr];
            if (anchor && listInstancesCache.has(anchor)) {
                listInstancesCache.delete(anchor);
            }
        }
        signalValues[curr] = undefined;
        computedRuntimes[curr] = null;
        signalOwners[curr] = null;
        subscriberHead[curr] = -1;
        signalNextOwned[curr] = -1;
        curr = next;
    }
    ownerFirstSignal.delete(instanceId);
}

export function cleanupComponentSinks(instanceId) {
    let curr = ownerFirstSink.has(instanceId) ? ownerFirstSink.get(instanceId) : -1;
    while (curr !== -1) {
        const next = sinkNextOwned[curr];
        if (sinkTypes[curr] === SINK_TYPE_EACH) {
            const anchor = sinkTargets[curr];
            if (anchor && listInstancesCache.has(anchor)) {
                listInstancesCache.delete(anchor);
            }
        }
        const prevSub = subscriberPrev[curr];
        const nextSub = subscriberNext[curr];
        if (prevSub !== -1) subscriberNext[prevSub] = nextSub;
        else if (subscriberSinks[curr] !== -1) subscriberHead[subscriberSinks[curr]] = nextSub;
        if (nextSub !== -1) subscriberPrev[nextSub] = prevSub;

        sinkTargets[curr] = sinkMeta[curr] = sinkComponentIds[curr] = null;
        subscriberSinks[curr] = subscriberNext[curr] = subscriberPrev[curr] = -1;
        sinkNextOwned[curr] = -1;
        curr = next;
    }
    ownerFirstSink.delete(instanceId);
}

function applySink(sinkID) {
    const type = sinkTypes[sinkID];
    const value = signalValues[subscriberSinks[sinkID]];
    const el = sinkTargets[sinkID];

    if (type === SINK_TYPE_TEXT) {
        if (el) {
            hConsole(() => console.log('[applySink TEXT]', { sinkID, value, el, textContent: el.textContent }));
            el.textContent = value;
        }
    } else if (type === SINK_TYPE_SHOW) {
        if (el) el.style.display = value ? '' : 'none';
    } else if (type === SINK_TYPE_IF) {
        const meta = sinkMeta[sinkID];
        if (!meta) return;
        if (value) {
            if (!meta.currentElement.parentNode) {
                meta.anchor.parentNode.insertBefore(meta.currentElement, meta.anchor);
            }
        } else {
            if (meta.currentElement.parentNode) {
                meta.fragment.appendChild(meta.currentElement);
            }
        }
    } else if (type === SINK_TYPE_EACH) {
        reconcileList(el, value, sinkMeta[sinkID]);
    } else if (type === SINK_TYPE_STYLE) {
        if (el) {
            const { cssVar } = sinkMeta[sinkID] || {};
            if (cssVar) el.style.setProperty(cssVar, value);
        }
    } else if (type === SINK_TYPE_STYLE_OBJECT) {
        if (el && typeof value === 'object' && value !== null) {
            for (const key in value) {
                if (value.hasOwnProperty(key)) {
                    el.style[key] = value[key];
                }
            }
        }
    } else if (type === SINK_TYPE_CLASS_OBJECT) {
        const el = sinkTargets[sinkID];
        const classData = value;
        const meta = sinkMeta[sinkID] || { staticClasses: [] };

        hConsole(() => console.log('[applySink CLASS_OBJECT]', { sinkID, value, el, meta: sinkMeta[sinkID] }));

        if (el) {
            let dynamicClasses = [];
            if (typeof classData === 'string') {
                dynamicClasses = classData.split(/\s+/).filter(Boolean);
            } else if (Array.isArray(classData)) {
                dynamicClasses = classData.filter(Boolean);
            } else if (typeof classData === 'object' && classData !== null) {
                for (const key in classData) {
                    if (classData.hasOwnProperty(key) && classData[key]) {
                        dynamicClasses.push(key);
                    }
                }
            }
            const allClasses = [...meta.staticClasses, ...dynamicClasses];
            el.className = allClasses.join(' ');
        }
    } else if (type === SINK_TYPE_SYNC) {
        const meta = sinkMeta[sinkID];
        hConsole(() => console.log('[applySink SYNC]', { sinkID, value, el, meta: sinkMeta[sinkID] }));
        if (el && meta && meta.prop !== undefined) {
            if (meta.prop === 'checked') {
                el.checked = value;
            } else {
                el[meta.prop] = value;
            }
        }
    } else if (type === SINK_TYPE_COMPUTED) {
        evaluateComputed(sinkTargets[sinkID]);
    // } else if (type === SINK_TYPE_PROPERTY) {
    //     // const meta = sinkMeta[sinkID];
    //     // if (el && meta && meta.prop !== undefined) {
    //     //     el[meta.prop] = value;
    //     // }
    //     const meta = sinkMeta[sinkID];
    //     if (el && meta && meta.prop !== undefined) {
    //         if (meta.isAttribute) {
    //             // Para atributos data-* usamos setAttribute
    //             el.setAttribute(meta.prop, value);
    //         } else {
    //             el[meta.prop] = value;
    //         }
    //     }
    // }
    } else if (type === SINK_TYPE_PROPERTY) {
        const meta = sinkMeta[sinkID];
        if (el && meta && meta.prop !== undefined) {
            if (meta.isAttribute) {
                el.setAttribute(meta.prop, value);
                if (meta.prop.startsWith('data-')) {
                    const dataKey = meta.prop.slice(5);
                    el.dataset[dataKey] = value;
                }
            } else {
                el[meta.prop] = value;
            }
        }
    }
}