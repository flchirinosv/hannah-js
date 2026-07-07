// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal } from '../core/reactive.js';

  const _sfc_main = {
    // 🌟 MAGIA DEL FRAMEWORK: El hijo recibe las props como parámetros
    setup(props, emit) {
      const counter = createSignal(0);
      // 'props.message' contiene directamente el ID numérico de la señal del padre.
      // Al retornarlo en el contexto, el hijo se suscribe a la señal del padre en O(1)
      return {
        counter: counter,
        receivedMessage: props.message,
        emit
      };
    },
    events(context) {
      console.log('✅ [Ciclo de vida] Hijo instanciado y montado en el DOM');
      
      return {
        "#btn-reply": {
          click: (e) => {
            console.log('click en btn-reply del hijo');
            e.stopPropagation();
            let counter = readSignal(context.counter);

            counter++
            
            // Escribimos el nuevo valor en la memoria de la señal
            writeSignal(context.counter, counter);

            // Disparamos un evento Custom DOM nativo llamado 'child-reply'
            context.emit('child-reply', `¡Hola padre! Esta es mi respuesta #${counter}`);
          }
        }
      };
    }
  }

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="child-box" data-h-child-view=""><h3 class="child-title" data-h-child-view="">👶 Componente Hijo</h3><p data-h-child-view="">Mensaje desde el padre: <span class="prop-highlight" h-text="receivedMessage" data-h-child-view=""></span></p><p style="color: #888; font-size: 0.9em;" data-h-child-view="">Mira la consola: Me destruyo y me recreo limpiamente.</p><button id="btn-reply" class="btn-reply" data-h-child-view="">Responder al Padre</button></div>`;

_sfc_main.name = 'child-view';
_sfc_main.styles = `.child-box[data-h-child-view] {  padding: 1.5rem;  border: 2px dashed #e74c3c;  border-radius: 8px;  background: #1a1111;  margin-top: 1rem;  }  .child-title[data-h-child-view] {  color: #e74c3c; margin-top: 0;  }  .prop-highlight[data-h-child-view] {  color: #f1c40f; font-weight: bold;  }  .btn-reply[data-h-child-view] {  background: #f1c40f; color: black; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 15px;  }  .btn-reply[data-h-child-view]:hover {  opacity: 0.9;  }`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[1].childNodes[1];
        if (context.receivedMessage !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.receivedMessage, instanceId);
        }
    }

    return fragment;
};

export const ChildViewComponent = _sfc_main;
