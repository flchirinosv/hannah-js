// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

const _sfc_main = {
  data() {
    return {
      showChild: false,
      parentMessage: 'Mensaje estático inicial',
      childReply: 'Ninguna todavía...',
      mutationCount: 0
    };
  },
  computed: {
    statusText(ctx) {
      return ctx.showChild ? 'Instanciado (Visible)' : 'Destruido (Oculto)';
    }
  },
  methods: {
    toggleChild(ctx) {
      ctx.showChild = !ctx.showChild;
    },
    mutateProp(ctx) {
      ctx.mutationCount++;
      ctx.parentMessage = `Mutación reactiva #${ctx.mutationCount}`;
    }
  },
  events(ctx) {
    // Para escuchar eventos personalizados del hijo
    return {
      '[h-component="child-view"]': {
        'child-reply': (e) => {
          ctx.childReply = e.detail;
        }
      }
    };
  }
}

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="parent-box" data-h-parent-view=""><h2 style="color: #3498db; margin-top: 0;" data-h-parent-view="">👨 Componente Padre</h2><div class="controls" data-h-parent-view=""><button id="btn-toggle" class="btn-primary" h-on:click="toggleChild" data-h-parent-view="">Alternar h-if</button><button id="btn-mutate" class="btn-secondary" h-on:click="mutateProp" data-h-parent-view="">Mutar Prop</button></div><p data-h-parent-view="">Estado del hijo: <strong h-text="statusText" data-h-parent-view="">Oculto</strong></p><div class="reply-box" data-h-parent-view="">
       Última respuesta: <strong h-text="childReply" style="color: #f1c40f;" data-h-parent-view="">Ninguna todavía...</strong></div><div h-if="showChild" data-h-parent-view=""><div h-component="child-view" h-bind:message="parentMessage" data-h-parent-view=""></div></div></div>`;

_sfc_main.name = 'parent-view';
_sfc_main.styles = `.parent-box[data-h-parent-view] {
  padding: 1.5rem;
    border: 1px solid #3498db;
    border-radius: 12px;
    background: #0d151c;
    max-width: 500px;
    margin: 2rem auto;
}

.controls[data-h-parent-view] {
  display: flex; gap: 10px; margin-bottom: 1rem;
}

.btn-primary[data-h-parent-view] {
  background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;
}

.btn-secondary[data-h-parent-view] {
  background: #2c3e50; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer;
}

.reply-box[data-h-parent-view] {
  margin-top: 15px; padding: 10px; background: #1a252c; border-left: 3px solid #f1c40f; color: #ecf0f1; border-radius: 4px;
}`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[2].childNodes[1];
        if (context.statusText !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.statusText, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[3].childNodes[1];
        if (context.childReply !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.childReply, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[4];
        if (context.showChild !== undefined) {
            registerSink(targetEl, SINK_TYPE_IF, context.showChild, instanceId, anchor_0);
        }
    }

    return fragment;
};

export const ParentViewComponent = _sfc_main;
