// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal, createComputed } from '../core/reactive.js';

const _sfc_main = {
  setup() {
    console.log('[theme-panel] setup ejecutado');
    
    const darkMode = createSignal(false);
    const showAdvanced = createSignal(false);
    const bgColor = createSignal('#1a1a1e');
    const textColor = createSignal('#e1e1e6');
    const status = createSignal(0);
    const basePadding = createSignal('1rem');

    // Computed: panelClasses (objeto con clases condicionales)
    const panelClasses = createComputed(() => ({
      'dark-mode': readSignal(darkMode),
      'light-mode': !readSignal(darkMode)
    }));

    // Computed: previewStyles (objeto de estilos)
    const previewStyles = createComputed(() => ({
      backgroundColor: readSignal(bgColor),
      color: readSignal(textColor),
      padding: readSignal(basePadding),
      border: '2px solid ' + readSignal(bgColor)
    }));

    // Computed: tagClasses (array con clases condicionales)
    const tagClasses = createComputed(() => {
      const s = readSignal(status);
      return [
        s === 0 ? '' : s === 1 ? 'warning' : 'danger',
        s === 0 ? '' : 'tag'
      ].filter(Boolean);
    });

    // Computed: statusText
    const statusText = createComputed(() => {
      const s = readSignal(status);
      return s === 0 ? '🟢 Normal' : s === 1 ? '🟡 Advertencia' : '🔴 Crítico';
    });

    // Computed: previewMessage
    const previewMessage = createComputed(() => {
      const s = readSignal(status);
      return s === 0 ? 'Todo en orden' : s === 1 ? 'Alerta moderada' : '¡Alerta máxima!';
    });

    const modeLabel = createComputed(() => 
        readSignal(darkMode) ? '🌙 Oscuro' : '☀️ Claro'
    );

    return {
      darkMode,
      showAdvanced,
      bgColor,
      textColor,
      status,
      basePadding,
      panelClasses,
      previewStyles,
      tagClasses,
      statusText,
      previewMessage,
      modeLabel,
      toggleDarkMode: (context) => {
          console.log('toggleDarkMode ejecutado');
          const current = readSignal(context.darkMode);
          writeSignal(context.darkMode, !current);
      },
      toggleAdvanced: (context) => {
          const current = readSignal(context.showAdvanced);
          writeSignal(context.showAdvanced, !current);
      },
      cycleStatus: (context) => {
          const current = readSignal(context.status);
          writeSignal(context.status, (current + 1) % 3);
      },
      applyRandomStyle: (context) => {
          const colors = ['#2d1b4e', '#0f3b21', '#4a1515', '#15304a', '#3a2a5a', '#1e4a3a', '#5a2a2a'];
          const texts = ['#f0f0f5', '#e1e1e6', '#ffd700', '#ff6b6b', '#a8e6cf'];
          const pads = ['0.5rem', '1rem', '1.5rem', '2rem', '2.5rem'];

          const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

          writeSignal(context.bgColor, rand(colors));
          writeSignal(context.textColor, rand(texts));
          writeSignal(context.basePadding, rand(pads));
      },
      resetStyles: (context) => {
          console.log('resetStyles ejecutado');
          writeSignal(context.bgColor, '#1a1a1e');
          writeSignal(context.textColor, '#e1e1e6');
          writeSignal(context.basePadding, '1rem');
          writeSignal(context.darkMode, false);
          writeSignal(context.showAdvanced, false);
          writeSignal(context.status, 0);
      }
    };
  }
}

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="panel" h-bind:class="panelClasses" data-h-theme-panel=""><h2 data-h-theme-panel="">🎨 Panel de Tema</h2><div class="controls" data-h-theme-panel=""><div class="control-row" data-h-theme-panel=""><label data-h-theme-panel="">Modo:</label><div data-h-theme-panel=""><!-- <button h-click="toggleDarkMode" style="margin-right: 0.5rem">
                {{ darkMode ? '🌙 Oscuro' : '☀️ Claro' }}
            </button> --><button h-click="toggleDarkMode" style="margin-right: 0.5rem" data-h-theme-panel=""><span h-text="modeLabel" data-h-theme-panel=""></span></button><button h-click="toggleAdvanced" data-h-theme-panel="">⚙️ Avanzado</button></div></div><div class="control-row" h-show="showAdvanced" data-h-theme-panel=""><label data-h-theme-panel="">Color de fondo:</label><input type="color" h-sync="bgColor" data-h-theme-panel=""/><input type="text" h-sync="bgColor" placeholder="#hex" style="flex: 1;" data-h-theme-panel=""/></div><div class="control-row" h-show="showAdvanced" data-h-theme-panel=""><label data-h-theme-panel="">Color de texto:</label><input type="color" h-sync="textColor" data-h-theme-panel=""/></div><div class="control-row" data-h-theme-panel=""><label data-h-theme-panel="">Etiqueta de estado:</label><span h-bind:class="tagClasses" data-h-theme-panel=""><span h-text="statusText" data-h-theme-panel="">Normal</span></span><button h-click="cycleStatus" data-h-theme-panel="">🔄 Cambiar estado</button></div><div class="control-row" data-h-theme-panel=""><label data-h-theme-panel="">Estilo avanzado:</label><button h-click="applyRandomStyle" data-h-theme-panel="">🎲 Aleatorio</button><button h-click="resetStyles" class="reset-btn" data-h-theme-panel="">↺ Reset</button></div></div><!-- Caja de previsualización con estilos dinámicos --><div class="preview-box" h-style="previewStyles" data-h-theme-panel=""><p data-h-theme-panel=""><span h-text="previewMessage" data-h-theme-panel="">Hola mundo</span><span class="tag" h-bind:class="tagClasses" data-h-theme-panel="">Reactivo</span></p><small data-h-theme-panel="">Este estilo cambia con el color de fondo y texto.</small></div><p style="margin-top: 1.5rem; font-size: 0.8rem; opacity: 0.7; text-align: center;" data-h-theme-panel="">
      ⚡ Todo es reactivo: h-style, h-bind:class, h-sync, h-click, h-show, h-text, etc.
    </p></div>`;

_sfc_main.name = 'theme-panel';
_sfc_main.styles = `.panel[data-h-theme-panel] {  padding: 2rem;  border-radius: 12px;  max-width: 500px;  margin: 2rem auto;  box-shadow: 0 8px 20px rgba(0,0,0,0.3);  transition: all 0.3s ease;  }  .panel.dark-mode[data-h-theme-panel] {  background: #1a1a1e;  color: #e1e1e6;  border: 1px solid #333;  }  .panel.light-mode[data-h-theme-panel] {  background: #f0f0f5;  color: #1a1a1e;  border: 1px solid #ccc;  }  .controls[data-h-theme-panel] {  display: flex;  flex-direction: column;  gap: 1rem;  }  .control-row[data-h-theme-panel] {  display: flex;  align-items: center;  gap: 1rem;  justify-content: space-between;  }  label[data-h-theme-panel] {  font-weight: bold;  }  input[type="text"][data-h-theme-panel], input[type="color"][data-h-theme-panel] {  padding: 0.5rem;  border-radius: 6px;  border: 1px solid #555;  background: #2a2a2e;  color: #e1e1e6;  flex: 1;  }  .preview-box[data-h-theme-panel] {  padding: 1rem;  border-radius: 8px;  margin-top: 1rem;  text-align: center;  font-weight: bold;  transition: all 0.3s ease;  }  .tag[data-h-theme-panel] {  display: inline-block;  padding: 0.2rem 0.8rem;  border-radius: 20px;  font-size: 0.8rem;  background: rgba(4, 211, 97, 0.2);  color: #04d361;  margin-left: 0.5rem;  }  .tag.warning[data-h-theme-panel] {  background: rgba(255, 193, 7, 0.2);  color: #ffc107;  }  .tag.danger[data-h-theme-panel] {  background: rgba(255, 68, 68, 0.2);  color: #ff4444;  }  button[data-h-theme-panel] {  background: #04d361;  color: #000;  border: none;  padding: 0.5rem 1.2rem;  border-radius: 6px;  cursor: pointer;  font-weight: bold;  transition: opacity 0.2s;  }  button[data-h-theme-panel]:hover {  opacity: 0.8;  }  .reset-btn[data-h-theme-panel] {  background: #ff4444;  color: white;  }`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[1].childNodes[0].childNodes[1].childNodes[1].childNodes[0];
        if (context.modeLabel !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.modeLabel, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[1].childNodes[1];
        if (context.showAdvanced !== undefined) {
            registerSink(targetEl, SINK_TYPE_SHOW, context.showAdvanced, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[1].childNodes[2];
        if (context.showAdvanced !== undefined) {
            registerSink(targetEl, SINK_TYPE_SHOW, context.showAdvanced, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[1].childNodes[3].childNodes[1].childNodes[0];
        if (context.statusText !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.statusText, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[3].childNodes[0].childNodes[0];
        if (context.previewMessage !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.previewMessage, instanceId);
        }
    }

    return fragment;
};

export const ThemePanelComponent = _sfc_main;
