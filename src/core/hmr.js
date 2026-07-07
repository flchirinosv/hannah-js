// src/core/hmr.js
import { componentRegistry, destroyComponentInstance, initializeComponent, styleManager, hConsole } from './core.js';

const wsUrl = `ws://${window.location.host}/hmr`;
let ws;

function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        hConsole(() => console.log('🟢 Hannah HMR conectado'));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
            hConsole(() => console.log(`🔄 Actualizando módulo: ${data.path}`));
            
            const moduleUrl = `${data.path}?t=${data.timestamp}`;
            const componentName = data.path.split('/').pop().replace('.js', '');

            // Limpiar funciones auxiliares del objeto global dedicado
            if (window.__hannah_expr) {
                const prefix = `__expr_${componentName}_`;
                Object.keys(window.__hannah_expr).forEach(key => {
                    if (key.startsWith(prefix)) {
                        delete window.__hannah_expr[key];
                    }
                });
            }
            
            try {
                const newModule = await import(moduleUrl);
                const exportKeys = Object.keys(newModule);
                const componentKey = exportKeys.find(k => k.endsWith('Component'));
                const updatedComponent = newModule[componentKey];

                if (!updatedComponent || !updatedComponent.name) {
                    hConsole(() => console.warn('⚠️ No se pudo encontrar el componente exportado'));
                    return;
                }

                componentRegistry.set(updatedComponent.name, updatedComponent);

                if (updatedComponent.styles) {
                    const scopeId = `data-h-${updatedComponent.name}`;
                    styleManager.update(scopeId, updatedComponent.styles);
                }

                const nodes = document.querySelectorAll(`[h-component="${updatedComponent.name}"]`);
                hConsole(() => console.log(`♻️ Reinicializando ${nodes.length} instancias de [${updatedComponent.name}]...`));

                if (nodes.length === 0) {
                    hConsole(() => console.warn(`⚠️ No se encontraron nodos con h-component="${updatedComponent.name}"`));
                    return;
                }

                nodes.forEach(el => {
                    destroyComponentInstance(el.id);
                    const parent = el.parentNode;
                    const newEl = el.cloneNode(true);
                    parent.replaceChild(newEl, el);
                    requestAnimationFrame(() => initializeComponent(newEl));
                });

                hConsole(() => console.log('✅ HMR aplicado correctamente'));
            } catch (err) {
                hConsole(() => console.error('❌ Error aplicando HMR:', err));
            }
        }
    };

    ws.onclose = () => {
        hConsole(() => console.log('🔴 Hannah HMR desconectado. Reconectando en 2s...'));
        setTimeout(connect, 2000);
    };
}

connect();