// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal } from '../core/reactive.js';

  const _sfc_main = {
    // setup() {
    //   // Las señales deben crearse con createSignal
    //   return {
    //     name: createSignal('Nuevo Usuario'),
    //     role: createSignal('Guest')
    //   };
    // },
    // events(context) {
    //   return {
    //     '#btn-promote': {
    //       click: () => {
    //         const status = readSignal(context.role);
    //         writeSignal(context.role, status === 'Admin' ? 'Guest' : 'Admin');
    //       }
    //     }
    //   };
    // }
    data() {
      return {
        name: 'Nuevo Usuario',
        role: 'Guest'
      }
    },
    methods: {
      toggle(ctx) {
        ctx.role = ctx.role === 'Guest' ? 'Admin' : 'Guest'
      }
    }
  }

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="card" data-h-user-card=""><h3 class="title" h-text="name" data-h-user-card="">Usuario</h3><p h-text="role" data-h-user-card="">Rol</p><button id="btn-promote" h-on:click="toggle" data-h-user-card="">Promover</button></div>`;

_sfc_main.name = 'user-card';
_sfc_main.styles = `/*[data-h-user-card] El CSS es Scoped automáticamente por el compilador de Go */ .card {  border: 1px solid #333; padding: 1rem; border-radius: 8px;  }  .title[data-h-user-card] {  color: #04d361; font-weight: bold;  }`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[1];
        if (context.role !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.role, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[0];
        if (context.name !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.name, instanceId);
        }
    }

    return fragment;
};

export const UserCardComponent = _sfc_main;
