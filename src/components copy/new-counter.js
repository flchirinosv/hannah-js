// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

const _sfc_main = {
  data() {
    return {
      message: 'Hola',
      count: 0
    };
  },
  methods: {
    increment(ctx) {
      ctx.count++;
    },
    reset(ctx) {
      ctx.count = 0;
      ctx.message = 'Reiniciado';
    }
  },
  computed: {
    doubled(ctx) {
      return ctx.count * 2;
    }
  }
}

const tpl = document.createElement('template');
tpl.innerHTML = `<div data-h-new-counter=""><p h-text="message" data-h-new-counter=""></p><input h-sync="message" data-h-new-counter=""/><!-- Nueva sintaxis h-on: --><button h-on:click="increment" data-h-new-counter="">Incrementar</button><!-- También funciona h-click (compatibilidad) --><button h-click="reset" data-h-new-counter="">Reset</button><p data-h-new-counter="">Contador: <span h-text="count" data-h-new-counter=""></span> (doble: <span h-text="doubled" data-h-new-counter=""></span>)</p></div>`;

_sfc_main.name = 'new-counter';
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[0];
        if (context.message !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.message, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[6].childNodes[1];
        if (context.count !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.count, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[6].childNodes[3];
        if (context.doubled !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.doubled, instanceId);
        }
    }

    return fragment;
};

export const NewCounterComponent = _sfc_main;
