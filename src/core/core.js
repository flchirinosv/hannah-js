import { 
    cleanupComponentSinks, 
    setCurrentOwner, 
    cleanupComponentSignals,
    createSignal,
    readSignal,
    writeSignal,
    createComputed
} from './reactive.js';
import { compileDirectives } from './directives.js';

const DEBUG = false;

export function hConsole(callback = null) {
    if (!DEBUG) return;
    callback.call()
}

export const componentRegistry = new Map();
const activeInstances = new Set();
export const instanceContexts = new Map();
export const instanceEventContexts = new Map();

let instanceIdCounter = 0; // Contador incremental (respaldo si crypto no está disponible)

function generateInstanceId(compName) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `h-${compName}-${crypto.randomUUID()}`;
    }
    // Fallback a contador seguro
    return `h-${compName}-${++instanceIdCounter}-${Date.now().toString(36)}`;
}

export function defineComponent(name, options) {
    componentRegistry.set(name, options);
}

export function initializeComponent(element) {
    const compName = element.getAttribute('h-component');
    if (!compName) return;

    const options = componentRegistry.get(compName);
    if (!options) {
        hConsole(() => console.warn(`[Hannah] Componente no registrado: "${compName}"`));
        return;
    }

    // Usar ID existente o generar uno nuevo
    let instanceId = element.id || generateInstanceId(compName);
    element.id = instanceId;

    if (activeInstances.has(instanceId)) return;
    activeInstances.add(instanceId);

    const scopeId = `data-h-${compName}`;
    element.setAttribute(scopeId, '');

    // ---- Props ----
    const props = {};
    const parentElement = element.parentElement?.closest('[h-component]');
    if (parentElement && instanceContexts.has(parentElement.id)) {
        const parentContext = instanceContexts.get(parentElement.id);
        const attrs = element.attributes;
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr.name.startsWith('h-bind:')) {
                const propName = attr.name.slice(7).replace(/-([a-z])/g, g => g[1].toUpperCase());
                const parentSignalID = parentContext[attr.value];
                if (parentSignalID !== undefined) {
                    props[propName] = parentSignalID;
                }
            }
        }
    }

    // ---- Emisor de eventos ----
    const emit = (eventName, detail) => {
        element.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail }));
    };

    // ---- Construcción del contexto ----
    setCurrentOwner(instanceId);
    const setupResult = options.setup ? options.setup(props, emit) : {};
    setCurrentOwner(null);

    let signalMap = {};
    let renderContext = {};
    let userContext = {};

    userContext.emit = emit;
    userContext.props = props;

    let methodsObj = {};
    let eventsFn = null;

    renderContext.__signalMap = signalMap;

    for (const key in setupResult) {
        const val = setupResult[key];
        if (typeof val === 'function') {
            if (key === 'data') {
                const dataObj = val();
                for (const dKey in dataObj) {
                    const signalID = createSignal(dataObj[dKey]);
                    signalMap[dKey] = signalID;
                    renderContext[dKey] = signalID;
                }
                hConsole(() => console.log('[core] data procesado:', Object.keys(dataObj)));
            } else if (key === 'methods') {
                const rawMethods = val();
                Object.assign(userContext, rawMethods);
                hConsole(() => console.log('[core] methods enlazados:', Object.keys(rawMethods)));
            } else if (key === 'events') {
                eventsFn = val;
            } else {
                userContext[key] = val;
            }
        } else {
            userContext[key] = val;
        }
    }

    Object.assign(userContext, methodsObj);

    userContext = new Proxy(userContext, {
        get(target, prop) {
            if (prop === '__signalMap') return signalMap;
            if (prop in signalMap) {
                return readSignal(signalMap[prop]);
            }
            if (prop in target) {
                const val = target[prop];
                return val;
            }
            return undefined;
        },
        set(target, prop, value) {
            if (prop in signalMap) {
                writeSignal(signalMap[prop], value);
                return true;
            }
            target[prop] = value;
            return true;
        }
    });

    let userComputed = null;
    if (setupResult.computed) {
        if (typeof setupResult.computed === 'function') {
            userComputed = setupResult.computed(userContext);
        } else if (typeof setupResult.computed === 'object' && setupResult.computed !== null) {
            userComputed = setupResult.computed;
        }
    }

    let aotComputed = null;
    if (options.computed && typeof options.computed === 'object') {
        aotComputed = options.computed;
    }

    const finalComputed = { ...userComputed, ...aotComputed };
    if (Object.keys(finalComputed).length > 0) {
        for (const cKey in finalComputed) {
            const fn = finalComputed[cKey];
            const wrappedFn = typeof fn === 'function' ? () => fn(userContext) : fn;
            const computedID = createComputed(wrappedFn);
            signalMap[cKey] = computedID;
            renderContext[cKey] = computedID;
        }
        hConsole(() => console.log('[core] computed procesado (usuario + AOT):', Object.keys(finalComputed)));
    }

    if (eventsFn) {
        options._events = eventsFn;
    }

    hConsole(() => console.log('[core] userContext final:', Object.keys(userContext)));

    instanceContexts.set(instanceId, { renderContext, userContext, signalMap });
    instanceEventContexts.set(instanceId, userContext);

    if (typeof window !== 'undefined') {
        if (!window.__hannah_eventContexts) window.__hannah_eventContexts = new Map();
        window.__hannah_eventContexts.set(instanceId, userContext);
    }

    hConsole(() => console.log('[core] renderContext:', renderContext));

    // ---- Render ----
    if (options.render) {
        if (options.styles) {
            styleManager.register(scopeId, options.styles);
        }
        const compiledDOM = options.render(renderContext, instanceId);
        if (compiledDOM.firstElementChild) {
            compiledDOM.firstElementChild.setAttribute(scopeId, '');
        }
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        element.appendChild(compiledDOM);

        renderContext.__eventContext = userContext;

        compileDirectives(element, renderContext, instanceId, true, userContext);
    } else {
        if (!element.innerHTML.trim() && options.template) {
            const templateNode = document.createElement('template');
            templateNode.innerHTML = options.template;
            if (options.styles) {
                styleManager.register(scopeId, options.styles);
                const root = templateNode.content.firstElementChild;
                if (root) root.setAttribute(scopeId, '');
            }
            element.appendChild(templateNode.content.cloneNode(true));
        }

        renderContext.__eventContext = userContext;

        compileDirectives(element, renderContext, instanceId, false, userContext);
    }

    // ---- Delegación de eventos (options.events o _events) ----
    eventsFn = options._events || options.events;
    if (eventsFn) {
        const eventMap = typeof eventsFn === 'function' ? eventsFn(userContext) : eventsFn;
        if (eventMap) {
            Object.keys(eventMap).forEach(selector => {
                Object.keys(eventMap[selector]).forEach(type => {
                    element.addEventListener(type, (e) => {
                        const target = e.target.closest(selector);
                        if (target && element.contains(target)) {
                            eventMap[selector][type].call(target, userContext, e);
                        }
                    });
                });
            });
        }
    }
}

export function destroyComponentInstance(instanceId) {
    if (!activeInstances.has(instanceId)) return;
    cleanupComponentSinks(instanceId);
    cleanupComponentSignals(instanceId);
    activeInstances.delete(instanceId);
    instanceContexts.delete(instanceId);
    instanceEventContexts.delete(instanceId);

    if (typeof window !== 'undefined' && window.__hannah_eventContexts) {
        window.__hannah_eventContexts.delete(instanceId);
    }
}

export function bootFramework() {
    const elements = document.querySelectorAll('[h-component]');
    hConsole(() => console.log(`[Hannah] bootFramework: encontró ${elements.length} elementos`));
    elements.forEach(el => hConsole(() => console.log(`[Hannah] - Elemento: ${el.outerHTML}`)));
    elements.forEach(initializeComponent);

    const observer = new MutationObserver((mutations) => {
        const toInitialize = new Set(); // Evita duplicados
        const toDestroy = new Set();

        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node.nodeType === 1) {
                    if (node.hasAttribute('h-component')) toDestroy.add(node.id);
                    node.querySelectorAll('[h-component]').forEach(sub => toDestroy.add(sub.id));
                }
            }
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.hasAttribute('h-component')) toInitialize.add(node);
                    node.querySelectorAll('[h-component]').forEach(sub => toInitialize.add(sub));
                }
            }
        }

        // Destruir primero
        for (const id of toDestroy) {
            destroyComponentInstance(id);
        }
        // Luego inicializar
        for (const el of toInitialize) {
            initializeComponent(el);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// StyleManager (sin cambios)
class StyleManager {
    constructor() {
        this.registeredScopes = new Set();
        this.styleElements = new Map();
        this.styleSheets = new Map();
    }

    register(scopeId, cssText) {
        if (!cssText) return;
        if (this.registeredScopes.has(scopeId)) {
            this.update(scopeId, cssText);
            return;
        }
        this.registeredScopes.add(scopeId);

        if (document.adoptedStyleSheets) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            this.styleSheets.set(scopeId, sheet);
        } else {
            const style = document.createElement('style');
            style.setAttribute('data-scope', scopeId);
            style.textContent = cssText;
            document.head.appendChild(style);
            this.styleElements.set(scopeId, style);
        }
    }

    update(scopeId, cssText) {
        if (!cssText) return;
        if (document.adoptedStyleSheets && this.styleSheets.has(scopeId)) {
            const sheet = this.styleSheets.get(scopeId);
            sheet.replaceSync(cssText);
        } else if (this.styleElements.has(scopeId)) {
            this.styleElements.get(scopeId).textContent = cssText;
        }
    }
}
export const styleManager = new StyleManager();