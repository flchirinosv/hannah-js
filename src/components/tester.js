// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal } from '../core/reactive.js';

    const _sfc_main = {
        setup() {
            return {
                dataList: createSignal([]),
                nodeCount: createSignal(0)
            };
        },
        events(context) {
            const generateData = (count) => {
                const arr = [];
                for (let i = 0; i < count; i++) {
                    arr.push({ id: `user_${i}`, name: `Token [${Math.random().toString(36).substr(2, 5)}]` });
                }
                return arr;
            };

            return {
                '#btn-load': {
                    click: () => {
                        const t0 = performance.now();
                        const newData = generateData(5000);
                        writeSignal(context.dataList, newData);
                        writeSignal(context.nodeCount, newData.length);
                        console.log(`Montaje inicial: ${performance.now() - t0}ms`);
                    }
                },
                '#btn-shuffle': {
                    click: () => {
                        const t0 = performance.now();
                        const current = [...readSignal(context.dataList)];
                        for (let i = current.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [current[i], current[j]] = [current[j], current[i]];
                        }
                        writeSignal(context.dataList, current);
                        console.log(`Reconciliación LIS (Shuffle): ${performance.now() - t0}ms`);
                    }
                },
                '#btn-mutate': {
                    click: () => {
                        const t0 = performance.now();
                        const current = readSignal(context.dataList);
                        const mutated = current.map(item => ({
                            id: item.id,
                            name: `Mutado [${Math.random().toString(36).substr(2, 5)}]`
                        }));
                        writeSignal(context.dataList, mutated);
                        console.log(`Actualización Zero-GC: ${performance.now() - t0}ms`);
                    }
                },
                '#btn-clear': {
                    click: () => {
                        writeSignal(context.dataList, []);
                        writeSignal(context.nodeCount, 0);
                    }
                }
            };
        }
    }

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="tester-root" data-h-tester=""><div class="controls" data-h-tester=""><button id="btn-load" data-h-tester="">Generar 5000</button><button id="btn-shuffle" data-h-tester="">Desordenar (Shuffle)</button><button id="btn-mutate" data-h-tester="">Mutar Valores (Zero GC)</button><button id="btn-clear" class="danger" data-h-tester="">Limpiar DOM</button></div><p data-h-tester="">Prueba de Reconciliación LIS: <strong h-text="nodeCount" data-h-tester="">0</strong> Nodos</p><div class="grid" data-h-tester=""><template h-each="item in context.dataList" h-key="id" data-h-tester=""><div class="row" data-h-tester=""><span class="id-badge" h-text="item.id" data-h-tester=""></span><strong h-text="item.name" data-h-tester=""></strong></div></template></div></div>`;

_sfc_main.name = 'tester';
_sfc_main.styles = `body {
  font-family: monospace; background: #0c0c0e; color: #e1e1e6; padding: 2rem;
}

.tester-root[data-h-tester] {
  background: #141416; padding: 1.5rem; border-radius: 8px; border: 1px solid #232326;
}

.controls[data-h-tester] {
  display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;
}

button[data-h-tester] {
  background: #04d361; color: #000; border: none; padding: 10px 15px; font-weight: bold; cursor: pointer; border-radius: 4px;
}

button.danger[data-h-tester] {
  background: #ff4444; color: white;
}

.grid[data-h-tester] {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; height: 50vh; overflow-y: auto; padding: 10px; background: #000; border: 1px solid #333;
}

.row[data-h-tester] {
  background: #1c1c1f; padding: 10px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; border-left: 3px solid #04d361;
}

.id-badge[data-h-tester] {
  color: #888; font-size: 0.8em;
}`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[1].childNodes[1];
        if (context.nodeCount !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.nodeCount, instanceId);
        }
    }

    return fragment;
};

export const TesterComponent = _sfc_main;
