// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal } from '../core/reactive.js';

const _sfc_main = {
  setup() {
    const count = createSignal(0);

    return { 
      count,
      bgColor: createSignal('#141416'), // Valor inicial de la variable CSS
      increment: () => writeSignal(count, readSignal(count) + 1)
    }; 
  },
  events(context) {
    return {
      // '#btn-inc': {
      //   click: () => {
      //     const current = readSignal(context.count);
      //     writeSignal(context.count, current + 1);
      //   }
      // },
      '#btn-color': {
        click: () => {
          const colors = ['#141416', '#2d1b4e', '#0f3b21', '#4a1515', '#15304a'];
          const current = readSignal(context.bgColor);
          const nextIndex = (colors.indexOf(current) + 1) % colors.length;
          // Al escribir en la señal, el motor reactivo actualizará la variable CSS automáticamente
          writeSignal(context.bgColor, colors[nextIndex]);
        }
      }
    }
  }
}

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="counter-box" h-style:--dynamic-bg="bgColor" data-h-counter=""><h2 data-h-counter="">Contador AOT: <span h-text="count" data-h-counter="">0</span></h2><button id="btn-inc" h-click="increment" data-h-counter="">+ Incrementar</button><button id="btn-color" data-h-counter="">🎨 Cambiar Color</button></div>`;

_sfc_main.name = 'counter';
_sfc_main.styles = `.counter-box[data-h-counter] {  border: 1px solid #04d361;  padding: 1.5rem;  border-radius: 8px;  /* Usamos la variable CSS dinámica con un fallback (#141416) */  background-color: var(--dynamic-bg, #141416);  color: lightcyan;  transition: background-color 0.4s ease; /* Transición suave nativa del navegador */  }  .counter-box[data-h-counter] button {  background: #04d361; color: #000; font-weight: bold;  border: none; padding: 0.5rem 1rem; cursor: pointer; margin-right: 0.5rem;  }`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root;
        if (context.bgColor !== undefined) {
            registerSink(targetEl, SINK_TYPE_STYLE, context.bgColor, instanceId, { cssVar: '--dynamic-bg' });
        }
    }
    {
        const targetEl = root.childNodes[0].childNodes[1];
        if (context.count !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.count, instanceId);
        }
    }

    return fragment;
};

export const CounterComponent = _sfc_main;
