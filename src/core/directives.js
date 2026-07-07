import { 
    registerSink, 
    SINK_TYPE_TEXT, 
    SINK_TYPE_SHOW, 
    SINK_TYPE_IF, 
    SINK_TYPE_STYLE, 
    SINK_TYPE_SYNC, 
    SINK_TYPE_STYLE_OBJECT, 
    SINK_TYPE_CLASS_OBJECT,
    SINK_TYPE_PROPERTY,
    registerListSink, 
    signalValues,
    writeSignal,
    createComputed,
    readSignal  
} from './reactive.js';
import { hConsole } from './core.js';

function evaluateInContext(expr, ctx) {
    if (!expr || typeof expr !== 'string') return undefined;
    expr = expr.trim();
    // Si es una función auxiliar, no la evaluamos como expresión
    if (expr.startsWith('__expr_')) {
        return undefined;
    }
    if (expr.startsWith('{') && expr.endsWith('}')) {
        const content = expr.slice(1, -1).trim();
        const pairs = content.split(',').map(p => p.trim());
        const obj = {};
        for (const pair of pairs) {
            const [key, val] = pair.split(':').map(s => s.trim());
            obj[key] = evaluateInContext(val, ctx);
        }
        return obj;
    }
    if (expr.startsWith('[') && expr.endsWith(']')) {
        const content = expr.slice(1, -1).trim();
        if (content === '') return [];
        const items = content.split(',').map(s => evaluateInContext(s.trim(), ctx));
        return items;
    }
    if (expr.startsWith("'") || expr.startsWith('"')) {
        return expr.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
        return Number(expr);
    }
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (expr === 'undefined') return undefined;
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(expr)) {
        const parts = expr.split('.');
        let val = ctx;
        for (const part of parts) {
            if (val && typeof val === 'object' && part in val) {
                val = val[part];
            } else {
                if (val && val.__signalMap && val.__signalMap[part] !== undefined) {
                    val = readSignal(val.__signalMap[part]);
                } else {
                    return undefined;
                }
            }
        }
        return val;
    }
    if (expr.includes('?')) {
        const parts = expr.split('?');
        if (parts.length === 2) {
            const [cond, thenExpr] = parts;
            const [truePart, falsePart] = thenExpr.split(':').map(s => s.trim());
            const condVal = evaluateInContext(cond.trim(), ctx);
            return condVal ? evaluateInContext(truePart, ctx) : evaluateInContext(falsePart, ctx);
        }
    }
    console.warn('[Hannah] Expresión compleja no soportada:', expr);
    return undefined;
}

function normalizeAttrName(name) {
    if (name === 'h-bind:hecked') return 'h-bind:checked';
    return name;
}

function queryLocalDirectives(root, attrName) {
    const safeAttrName = attrName.replace(/:/g, '\\:');
    const elements = root.querySelectorAll(`[${safeAttrName}]`);
    const result = [];
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (root.nodeType === 11) {
            result.push(el);
            continue;
        }
        const owner = el.parentElement?.closest('[h-component]') || root;
        if (owner === root) {
            result.push(el);
        }
    }
    return result;
}

function getSignalID(context, name) {
    if (context.__signalMap && context.__signalMap[name] !== undefined) {
        return context.__signalMap[name];
    }
    const id = context[name];
    if (id !== undefined && typeof id === 'number') return id;
    return undefined;
}

function isSimpleIdentifier(str) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

function isAuxFn(value) {
    return value && typeof value === 'string' && value.startsWith('__expr_');
}

function createComputedFromAuxFn(value, ctx) {
    if (!isAuxFn(value)) return null;
    const fn = window.__hannah_expr?.[value];
    if (typeof fn === 'function') {
        // Verificar que la función se puede ejecutar sin errores
        try {
            fn(ctx);
        } catch (e) {
            // Si falla, no crear computada (contexto incorrecto)
            return null;
        }
        return createComputed(() => fn(ctx));
    }
    return null;
}

export function compileDirectives(root, context, instanceId, skipBasic = false, eventContext = null) {
    const evtCtx = eventContext || context;

    if (!skipBasic) {
        // ----- h-text -----
        const textNodes = queryLocalDirectives(root, 'h-text');
        for (let i = 0; i < textNodes.length; i++) {
            const el = textNodes[i];
            const signalID = getSignalID(context, el.getAttribute('h-text'));
            console.log('h-text signalID:', signalID, 'for', el.getAttribute('h-text'));
            if (signalID !== undefined) {
                registerSink(el, SINK_TYPE_TEXT, signalID, instanceId);
                el.textContent = signalValues[signalID];
            }
        }

        // ----- h-show (soporte para expresiones) -----
        const showNodes = queryLocalDirectives(root, 'h-show');
        for (let i = 0; i < showNodes.length; i++) {
            const el = showNodes[i];
            const value = el.getAttribute('h-show');
            let signalID = getSignalID(context, value);
            if (signalID !== undefined) {
                registerSink(el, SINK_TYPE_SHOW, signalID, instanceId);
                el.style.display = signalValues[signalID] ? '' : 'none';
            } else {
                const computedID = createComputedFromAuxFn(value, context);
                if (computedID !== null) {
                    registerSink(el, SINK_TYPE_SHOW, computedID, instanceId);
                    const val = signalValues[computedID];
                    if (val !== undefined) el.style.display = val ? '' : 'none';
                } else if (!isAuxFn(value)) {
                    const evalFn = () => evaluateInContext(value, context);
                    const compID = createComputed(evalFn);
                    registerSink(el, SINK_TYPE_SHOW, compID, instanceId);
                    const val = signalValues[compID];
                    if (val !== undefined) el.style.display = val ? '' : 'none';
                }
            }
        }

        // ----- h-if (soporte para expresiones) -----
        const ifNodes = queryLocalDirectives(root, 'h-if');
        for (let i = 0; i < ifNodes.length; i++) {
            const el = ifNodes[i];
            const value = el.getAttribute('h-if');
            let signalID = getSignalID(context, value);
            if (signalID !== undefined) {
                registerSink(el, SINK_TYPE_IF, signalID, instanceId);
            } else {
                const computedID = createComputedFromAuxFn(value, context);
                if (computedID !== null) {
                    registerSink(el, SINK_TYPE_IF, computedID, instanceId);
                } else if (!isAuxFn(value)) {
                    const evalFn = () => evaluateInContext(value, context);
                    const compID = createComputed(evalFn);
                    registerSink(el, SINK_TYPE_IF, compID, instanceId);
                }
            }
        }

        // ----- h-style: variables CSS -----
        const styleVarElements = queryLocalDirectives(root, 'h-style');
        for (let i = 0; i < styleVarElements.length; i++) {
            const el = styleVarElements[i];
            const attrs = el.attributes;
            for (let j = 0; j < attrs.length; j++) {
                const attr = attrs[j];
                if (attr.name.startsWith('h-style:')) {
                    const cssVar = attr.name.slice(8);
                    const signalID = getSignalID(context, attr.value);
                    if (signalID !== undefined) {
                        registerSink(el, SINK_TYPE_STYLE, signalID, instanceId, cssVar);
                        el.style.setProperty(`--${cssVar}`, signalValues[signalID]);
                    }
                }
            }
        }
    }

    // ----- h-each (siempre se procesa) -----
    const eachNodes = queryLocalDirectives(root, 'h-each');
    for (let i = 0; i < eachNodes.length; i++) {
        const el = eachNodes[i];
        const expression = el.getAttribute('h-each');
        const keyProp = el.getAttribute('h-key');
        let match = expression.match(/^\s*(\w+)\s+in\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        if (!match) {
            match = expression.match(/^\s*(\w+)\s+in\s+context\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        }
        if (match && keyProp) {
            const itemName = match[1];
            const arrayName = match[2];
            let arraySignalID = getSignalID(context, arrayName);
            if (arraySignalID === undefined && context[arrayName] !== undefined) {
                arraySignalID = context[arrayName];
                if (typeof arraySignalID !== 'number') {
                    console.warn(`[Hannah] ${arrayName} no es una señal válida`);
                    continue;
                }
            }
            if (arraySignalID !== undefined) {
                registerListSink(el, arraySignalID, keyProp, itemName, instanceId, compileDirectives, eventContext);
            }
        }
    }

    // ----- h-sync (siempre se procesa) -----
    // const syncElements = queryLocalDirectives(root, 'h-sync');
    // for (let i = 0; i < syncElements.length; i++) {
    //     const el = syncElements[i];
    //     const signalName = el.getAttribute('h-sync');
    //     const signalID = getSignalID(context, signalName);

    //     if (signalID === undefined) {
    //         hConsole(() => console.warn(`[Hannah] h-sync: señal "${signalName}" no encontrada`));
    //         continue;
    //     }

    //     let prop = 'value';
    //     let event = 'input';
    //     const tag = el.tagName.toLowerCase();
    //     if (tag === 'input') {
    //         const type = el.type;
    //         if (type === 'checkbox' || type === 'radio') {
    //             prop = 'checked';
    //             event = 'change';
    //         } else {
    //             prop = 'value';
    //             event = 'input';
    //         }
    //     } else if (tag === 'select' || tag === 'textarea') {
    //         prop = 'value';
    //         event = 'change';
    //     } else {
    //         prop = 'textContent';
    //         event = 'input';
    //     }

    //     el.addEventListener(event, (e) => {
    //         let newVal = e.target[prop];
    //         if (prop === 'checked') newVal = e.target.checked;
    //         writeSignal(signalID, newVal);
    //     });

    //     registerSink(el, SINK_TYPE_SYNC, signalID, instanceId, { prop });

    //     const currentValue = readSignal(signalID);
    //     if (currentValue !== undefined) {
    //         if (prop === 'checked') {
    //             el.checked = currentValue;
    //         } else {
    //             el[prop] = currentValue;
    //         }
    //     }

    //     registerSink(el, SINK_TYPE_PROPERTY, signalID, instanceId, { prop: prop, isAttribute: false });
    // }
    // ----- h-sync (siempre se procesa) -----
    // const syncElements = queryLocalDirectives(root, 'h-sync');
    // for (let i = 0; i < syncElements.length; i++) {
    //     const el = syncElements[i];
    //     const signalName = el.getAttribute('h-sync');
    //     const signalID = getSignalID(context, signalName);

    //     console.log(`[h-sync] signalName: ${signalName}, signalID: ${signalID}, element:`, el);

    //     if (signalID === undefined) {
    //         hConsole(() => console.warn(`[Hannah] h-sync: señal "${signalName}" no encontrada`));
    //         continue;
    //     }

    //     let prop = 'value';
    //     let event = 'input';
    //     const tag = el.tagName.toLowerCase();
    //     if (tag === 'input') {
    //         const type = el.type;
    //         if (type === 'checkbox' || type === 'radio') {
    //             prop = 'checked';
    //             event = 'change';
    //         } else {
    //             prop = 'value';
    //             event = 'input';
    //         }
    //     } else if (tag === 'select' || tag === 'textarea') {
    //         prop = 'value';
    //         event = 'change';
    //     } else {
    //         prop = 'textContent';
    //         event = 'input';
    //     }

    //     console.log(`[h-sync] event: ${event}, prop: ${prop}`);

    //     el.addEventListener(event, (e) => {
    //         let newVal = e.target[prop];
    //         if (prop === 'checked') newVal = e.target.checked;
    //         console.log(`[h-sync] event fired, newVal: ${newVal}, signalID: ${signalID}`);
    //         writeSignal(signalID, newVal);
    //     });

    //     registerSink(el, SINK_TYPE_SYNC, signalID, instanceId, { prop });

    //     const currentValue = readSignal(signalID);
    //     console.log(`[h-sync] currentValue: ${currentValue}`);
    //     if (currentValue !== undefined) {
    //         if (prop === 'checked') {
    //             el.checked = currentValue;
    //         } else {
    //             el[prop] = currentValue;
    //         }
    //     }

    //     registerSink(el, SINK_TYPE_PROPERTY, signalID, instanceId, { prop: prop, isAttribute: false });
    // }
    // ----- h-sync (siempre se procesa) -----
    const syncElements = queryLocalDirectives(root, 'h-sync');
    for (let i = 0; i < syncElements.length; i++) {
        const el = syncElements[i];
        const signalName = el.getAttribute('h-sync');
        const signalID = getSignalID(context, signalName);

        if (signalID === undefined) {
            hConsole(() => console.warn(`[Hannah] h-sync: señal "${signalName}" no encontrada`));
            continue;
        }

        // Determinar prop y evento
        let prop = 'value';
        let event = 'input';
        const tag = el.tagName.toLowerCase();
        if (tag === 'input') {
            const type = el.type;
            if (type === 'checkbox' || type === 'radio') {
                prop = 'checked';
                event = 'change';
            } else {
                prop = 'value';
                event = 'input';
            }
        } else if (tag === 'select' || tag === 'textarea') {
            prop = 'value';
            event = 'change';
        } else {
            prop = 'textContent';
            event = 'input';
        }

        // 🔥 Detectar si estamos dentro de un h-each (contexto local)
        let isInsideEach = false;
        let itemName = null;
        let parentContext = eventContext || context;
        // Si el contexto tiene __signalMap y contiene claves con patron "itemName.prop", estamos dentro de un h-each
        if (context.__signalMap) {
            const keys = Object.keys(context.__signalMap);
            for (const key of keys) {
                if (key.includes('.') && key !== '__signalMap') {
                    isInsideEach = true;
                    itemName = key.split('.')[0];
                    break;
                }
            }
        }

        // // Función para actualizar el objeto plano en el array del padre
        // function updateParentObject(value) {
        //     if (!isInsideEach || !itemName) return;
        //     // Intentar encontrar el array en el contexto padre (eventContext)
        //     if (!eventContext) return;
        //     // Buscar el array correspondiente al h-each
        //     // Asumimos que el array se llama igual que el itemName + 's' o similar, pero no es confiable.
        //     // En su lugar, buscamos en eventContext cualquier propiedad que sea un array y contenga un objeto con la clave del item.
        //     // Para simplificar, el desarrollador debe pasar el array como "todos" y el itemName es "todo".
        //     // Hardcodeamos: buscar el array en eventContext que coincida con itemName + 's' (todos -> todo)
        //     let arrayName = itemName + 's';
        //     if (eventContext[arrayName] && Array.isArray(eventContext[arrayName])) {
        //         const array = eventContext[arrayName];
        //         // Buscar el item por la clave primaria (id)
        //         const keyProp = el.getAttribute('h-key') || 'id';
        //         // Obtenemos el valor de la clave primaria del objeto plano actual (a través de context[itemName])
        //         const itemProxy = context[itemName];
        //         if (itemProxy && itemProxy[keyProp] !== undefined) {
        //             const itemId = itemProxy[keyProp];
        //             const item = array.find(it => it[keyProp] === itemId);
        //             if (item) {
        //                 // Extraer el nombre de la propiedad de la señal (ej: "todo.editingText" -> "editingText")
        //                 const propName = signalName.includes('.') ? signalName.split('.')[1] : signalName;
        //                 item[propName] = value;
        //                 // Forzar actualización del array en el contexto padre para que se dispare la reactividad
        //                 eventContext[arrayName] = [...array];
        //             }
        //         }
        //     }
        // }
        function updateParentObject(value) {
            if (!isInsideEach || !itemName) return;
            if (!eventContext) return;

            // 1. Obtener la clave primaria (id por defecto)
            const keyProp = el.getAttribute('h-key') || 'id';
            const itemProxy = context[itemName];
            if (!itemProxy) return;
            const itemId = itemProxy[keyProp];
            if (itemId === undefined) return;

            // 2. Buscar en todos los arrays del eventContext
            let found = false;
            for (const prop in eventContext) {
                const val = eventContext[prop];
                if (Array.isArray(val) && val.length > 0) {
                    // Buscar un objeto con la misma clave primaria
                    const item = val.find(it => it[keyProp] === itemId);
                    if (item) {
                        // Encontrado
                        const propName = signalName.includes('.') ? signalName.split('.')[1] : signalName;
                        item[propName] = value;
                        // Forzar actualización del array
                        eventContext[prop] = [...val];
                        found = true;
                        break;
                    }
                }
            }

            // 3. Si no se encontró, usar la convención itemName + 's' (fallback)
            if (!found) {
                let arrayName = itemName + 's';
                if (eventContext[arrayName] && Array.isArray(eventContext[arrayName])) {
                    const array = eventContext[arrayName];
                    const item = array.find(it => it[keyProp] === itemId);
                    if (item) {
                        const propName = signalName.includes('.') ? signalName.split('.')[1] : signalName;
                        item[propName] = value;
                        eventContext[arrayName] = [...array];
                    }
                }
            }
        }

        // // Listener del evento del elemento
        // el.addEventListener(event, (e) => {
        //     let newVal = e.target[prop];
        //     if (prop === 'checked') newVal = e.target.checked;
        //     // Escribir la señal
        //     writeSignal(signalID, newVal);
        //     // Actualizar el objeto plano en el padre
        //     updateParentObject(newVal);
        // });
        if (!el._hannah_listeners) el._hannah_listeners = {};
        if (!el._hannah_listeners[event]) {
            el._hannah_listeners[event] = true;
            el.addEventListener(event, (e) => {
                let newVal = e.target[prop];
                if (prop === 'checked') newVal = e.target.checked;
                writeSignal(signalID, newVal);
                updateParentObject(newVal);
            });
        }

        // Registrar sink SYNC (para actualizar el DOM desde la señal)
        registerSink(el, SINK_TYPE_SYNC, signalID, instanceId, { prop });

        // Valor inicial
        const currentValue = readSignal(signalID);
        if (currentValue !== undefined) {
            if (prop === 'checked') {
                el.checked = currentValue;
            } else {
                el[prop] = currentValue;
            }
        }

        // Registrar sink PROPERTY adicional para sincronizar desde la señal
        registerSink(el, SINK_TYPE_PROPERTY, signalID, instanceId, { prop: prop, isAttribute: false });
    }

    // ----- Barrido optimizado: solo elementos con atributos h-* -----
    let allElements = root.nodeType === 11 
        ? root.querySelectorAll('*') 
        : root.querySelectorAll('*');

    allElements = [...allElements].filter(el => [...el.attributes].some(attr => attr.name.startsWith('h-')));

    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];

        if (root.nodeType !== 11) {
            const owner = el.parentElement?.closest('[h-component]') || root;
            if (owner !== root) continue;
        }

        const attrs = el.attributes;
        for (let j = 0; j < attrs.length; j++) {
            const attr = attrs[j];
            let name = attr.name;
            const value = attr.value;

            name = normalizeAttrName(name);

            // ---------- h-bind:style (alias h-style) ----------
            if (name === 'h-style' || name === 'h-bind:style') {
                let signalID = getSignalID(context, value);
                if (signalID !== undefined) {
                    registerSink(el, SINK_TYPE_STYLE_OBJECT, signalID, instanceId);
                } else {
                    const computedID = createComputedFromAuxFn(value, context);
                    if (computedID !== null) {
                        registerSink(el, SINK_TYPE_STYLE_OBJECT, computedID, instanceId);
                    } else if (!isAuxFn(value)) {
                        const evalFn = () => evaluateInContext(value, context);
                        const compID = createComputed(evalFn);
                        registerSink(el, SINK_TYPE_STYLE_OBJECT, compID, instanceId);
                    } else {
                        hConsole(() => console.warn(`[Hannah] Función auxiliar no disponible: ${value}`));
                    }
                }
                continue;
            }

            // ---------- h-bind:class (alias h-class) ----------
            if (name === 'h-bind:class' || name === 'h-class') {
                const staticClasses = el.getAttribute('class') || '';
                const staticClassList = staticClasses.split(/\s+/).filter(Boolean);
                let signalID = getSignalID(context, value);
                if (signalID !== undefined) {
                    registerSink(el, SINK_TYPE_CLASS_OBJECT, signalID, instanceId, { staticClasses: staticClassList });
                } else {
                    const computedID = createComputedFromAuxFn(value, context);
                    if (computedID !== null) {
                        registerSink(el, SINK_TYPE_CLASS_OBJECT, computedID, instanceId, { staticClasses: staticClassList });
                    } else if (!isAuxFn(value)) {
                        const evalFn = () => evaluateInContext(value, context);
                        const compID = createComputed(evalFn);
                        registerSink(el, SINK_TYPE_CLASS_OBJECT, compID, instanceId, { staticClasses: staticClassList });
                    } else {
                        hConsole(() => console.warn(`[Hannah] Función auxiliar no disponible: ${value}`));
                    }
                }
                continue;
            }

            // // ---------- Event listeners (h-on:event y h-event) ----------
            // const onMatch = name.match(/^h-on:([a-z]+)$/);
            // if (onMatch) {
            //     const eventName = onMatch[1];
            //     const handlerName = value;
            //     const handler = evtCtx[handlerName];
            //     if (typeof handler === 'function') {
            //         // Agregar listener directamente (sin duplicar)
            //         el.addEventListener(eventName, function(e) {
            //             handler(evtCtx, e);
            //         });
            //     } else {
            //         hConsole(() => console.warn(`[Hannah] h-on:${eventName} espera una función, pero se encontró: ${typeof handler} (handlerName: ${handlerName}, evtCtx keys: ${Object.keys(evtCtx).join(', ')})`));
            //     }
            //     continue;
            // }

            // const eventMatch = name.match(/^h-([a-z]+)$/);
            // if (eventMatch) {
            //     const eventName = eventMatch[1];
            //     if (['text', 'show', 'if', 'each', 'key', 'style', 'component', 'bind', 'sync', 'class'].includes(eventName)) {
            //         continue;
            //     }
            //     const handler = evtCtx[value];
            //     if (typeof handler === 'function') {
            //         el.addEventListener(eventName, function(e) {
            //             handler(evtCtx, e);
            //         });
            //     } else {
            //         hConsole(() => console.warn(`[Hannah] h-${eventName} espera función, pero se encontró: ${typeof handler}`));
            //     }
            //     continue;
            // }
            const onMatch = name.match(/^h-on:([a-z]+)$/);
            if (onMatch) {
                const eventName = onMatch[1];
                const handlerName = value;
                const handler = evtCtx[handlerName];
                if (typeof handler === 'function') {
                    if (!el._hannah_listeners) el._hannah_listeners = {};
                    if (!el._hannah_listeners[eventName]) {
                        el._hannah_listeners[eventName] = true;
                        el.addEventListener(eventName, function(e) {
                            handler(evtCtx, e);
                        });
                    }
                } else {
                    hConsole(() => console.warn(`[Hannah] h-on:${eventName} espera una función, pero se encontró: ${typeof handler} (handlerName: ${handlerName}, evtCtx keys: ${Object.keys(evtCtx).join(', ')})`));
                }
                continue;
            }

            const eventMatch = name.match(/^h-([a-z]+)$/);
            if (eventMatch) {
                const eventName = eventMatch[1];
                if (['text', 'show', 'if', 'each', 'key', 'style', 'component', 'bind', 'sync', 'class'].includes(eventName)) {
                    continue;
                }
                const handler = evtCtx[value];
                if (typeof handler === 'function') {
                    if (!el._hannah_listeners) el._hannah_listeners = {};
                    if (!el._hannah_listeners[eventName]) {
                        el._hannah_listeners[eventName] = true;
                        el.addEventListener(eventName, function(e) {
                            handler(evtCtx, e);
                        });
                    }
                } else {
                    hConsole(() => console.warn(`[Hannah] h-${eventName} espera función, pero se encontró: ${typeof handler}`));
                }
                continue;
            }

            // ---------- h-bind:prop (checked, value, disabled, etc.) ----------
            if (name.startsWith('h-bind:') && name !== 'h-bind:class' && name !== 'h-bind:style') {
                let propName = name.slice(7);
                if (propName === 'hecked') propName = 'checked';
                
                const isDataAttr = propName.startsWith('data-');
                if (isDataAttr) {
                    if (value && typeof value === 'string') {
                        // Si es función auxiliar, no evaluar con evaluateInContext
                        if (isAuxFn(value)) {
                            const fn = window.__hannah_expr?.[value];
                            if (typeof fn === 'function') {
                                try {
                                    const val = fn(context);
                                    if (val !== undefined) {
                                        el.setAttribute(propName, val);
                                        const dataKey = propName.slice(5);
                                        el.dataset[dataKey] = val;
                                    }
                                } catch (e) {
                                    // silencioso
                                }
                            }
                        } else {
                            const val = evaluateInContext(value, context);
                            if (val !== undefined) {
                                el.setAttribute(propName, val);
                                const dataKey = propName.slice(5);
                                el.dataset[dataKey] = val;
                            }
                        }
                    }
                    continue;
                }

                let signalID = getSignalID(context, value);
                if (signalID !== undefined) {
                    registerSink(el, SINK_TYPE_PROPERTY, signalID, instanceId, { prop: propName, isAttribute: false });
                } else {
                    const computedID = createComputedFromAuxFn(value, context);
                    if (computedID !== null) {
                        registerSink(el, SINK_TYPE_PROPERTY, computedID, instanceId, { prop: propName, isAttribute: false });
                    } else if (!isAuxFn(value)) {
                        const evalFn = () => evaluateInContext(value, context);
                        const compID = createComputed(evalFn);
                        registerSink(el, SINK_TYPE_PROPERTY, compID, instanceId, { prop: propName, isAttribute: false });
                    } else {
                        console.warn(`[Hannah] Función auxiliar no disponible: ${value}`);
                    }
                }
                continue;
            }
        }
    }
}