// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR
import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';
import { compileDirectives } from '../core/directives.js';

import { createSignal, readSignal, writeSignal, createComputed } from '../core/reactive.js';

  const _sfc_main = {
    setup() {
      // 1. Inicialización de estado primario
      const saved = localStorage.getItem('hannah-todos');
      let initialTodos = saved ? JSON.parse(saved) : [];
      
      // let tmplist = []
      // for (let index = 0; index < 3000; index++) {
      //   tmplist = [...tmplist, { id: Date.now().toString(), text: `item ${index}`, completed: false }];
      // }
      // initialTodos = []
      
      const todos = createSignal(initialTodos);
      const inputValue = createSignal('');
      const filter = createSignal('all');

      // 2. Señales Computadas: Derivan de forma reactiva y automática
      const filteredTodos = createComputed(() => {
        const currentTodos = readSignal(todos);
        const currentFilter = readSignal(filter);

        if (currentFilter === 'active') return currentTodos.filter(t => !t.completed);
        if (currentFilter === 'completed') return currentTodos.filter(t => t.completed);
        return currentTodos;
      });

      const activeCount = createComputed(() => {
        return readSignal(todos).filter(t => !t.completed).length;
      });

      const isEmpty = createComputed(() => {
        return readSignal(todos).length === 0;
      });

      return {
        todos,
        inputValue,
        filter,
        filteredTodos,
        activeCount,
        isEmpty
      };
    },
    events(context) {

      const sync = (currentArray) => {
        localStorage.setItem('hannah-todos', JSON.stringify(currentArray));
        
        // Zero-GC: Aplicación de propiedades físicas con microtareas para evitar layout thrashing
        queueMicrotask(() => {
          const items = document.querySelectorAll('.todo-item');
          items.forEach(item => {
            const textEl = item.querySelector('.todo-text');
            if (!textEl) return;
            const todo = currentArray.find(t => t.text === textEl.textContent);
            if (todo) {
              const checkbox = item.querySelector('.todo-toggle');
              if (checkbox) checkbox.checked = todo.completed;
              if (todo.completed) item.classList.add('completed');
              else item.classList.remove('completed');
            }
          });
        });
      };

      // Hidratación asíncrona inicial de propiedades booleanas
      setTimeout(() => sync(readSignal(context.todos)), 0);

      return {
        '#btn-add': {
          click: () => {
            const text = readSignal(context.inputValue).trim();
            if (!text) return;
            
            // 🚨 Corrección Crítica: Leer el array actual, no el de inicio
            const currentTodos = [...readSignal(context.todos)];
            currentTodos.push({ id: Date.now().toString(), text, completed: false });
            
            writeSignal(context.todos, currentTodos);
            writeSignal(context.inputValue, '');
            
            const inputEl = document.getElementById('todo-input');
            if(inputEl) inputEl.value = '';

            sync(currentTodos);
          }
        },
        '#todo-input': {
          keydown: (e) => e.key === 'Enter' && document.getElementById('btn-add').click(),
          // input: (e) => writeSignal(context.inputValue, e.target.value)
        },
        '.todo-toggle': {
          change: (e) => {
            const itemEl = e.target.closest('li');
            const textEl = itemEl.querySelector('.todo-text');
            const currentTodos = [...readSignal(context.todos)];
            
            const todo = currentTodos.find(t => t.text === textEl.textContent);
            if (todo) {
              todo.completed = e.target.checked;
              writeSignal(context.todos, currentTodos);
              sync(currentTodos);
            }
          }
        },
        '.btn-delete': {
            click: (e) => {
                const itemEl = e.target.closest('.todo-item');
                const textEl = itemEl.querySelector('.todo-text');
                let currentTodos = readSignal(context.todos);
                
                currentTodos = currentTodos.filter(t => t.text !== textEl.textContent);
                
                writeSignal(context.todos, currentTodos); 
                sync(currentTodos);
            }
        },
        '.filter-btn': {
          click: (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Reemplazo de lógica imperativa. Solo mutamos el estado primario y el motor responde.
            writeSignal(context.filter, e.target.dataset.filter);
            
            // Sincronizamos las propiedades visuales tras el filtrado
            sync(readSignal(context.todos));
          }
        },
        '#btn-clear': {
          click: () => {
            let currentTodos = readSignal(context.todos);
            currentTodos = currentTodos.filter(t => !t.completed);
            
            writeSignal(context.todos, currentTodos);
            sync(currentTodos);
          }
        }
      };
    }
  }

const tpl = document.createElement('template');
tpl.innerHTML = `<div class="todo-app" data-h-todo-list=""><div class="todo-header" data-h-todo-list=""><p h-text="inputValue" data-h-todo-list=""></p><input id="todo-input" h-sync="inputValue" class="todo-input" type="text" placeholder="¿Qué necesitas hacer?" data-h-todo-list=""/><button id="btn-add" class="todo-btn" data-h-todo-list="">Añadir</button></div><div class="todo-filters" data-h-todo-list=""><button class="filter-btn active" data-filter="all" data-h-todo-list="">Todos</button><button class="filter-btn" data-filter="active" data-h-todo-list="">Activos</button><button class="filter-btn" data-filter="completed" data-h-todo-list="">Completados</button></div><div class="empty-container" data-h-todo-list=""><div class="empty-state" h-show="isEmpty" data-h-todo-list="">No hay tareas pendientes</div></div><ul class="todo-list" data-h-todo-list=""><template h-each="todo in context.filteredTodos" h-key="id" data-h-todo-list=""><li class="todo-item" data-h-todo-list=""><input type="checkbox" class="todo-toggle" data-h-todo-list=""/><span class="todo-text" h-text="todo.text" data-h-todo-list=""></span><button class="btn-delete" data-h-todo-list="">🗑️</button></li></template></ul><div class="todo-footer" data-h-todo-list=""><span data-h-todo-list="">Activos: <strong h-text="activeCount" data-h-todo-list="">0</strong></span><button id="btn-clear" class="todo-btn danger" data-h-todo-list="">Limpiar completados</button></div></div>`;

_sfc_main.name = 'todo-list';
_sfc_main.styles = `/*[data-h-todo-list] CSS Scoped automáticamente por el compilador Go */ .todo-app {  max-width: 600px; margin: 2rem auto; background: #141416; border: 1px solid #232326; border-radius: 12px; padding: 1.5rem;  }  .todo-header[data-h-todo-list] {  display: flex; gap: 0.5rem; margin-bottom: 1rem;  }  .todo-input[data-h-todo-list] {  flex: 1; background: #0c0c0e; border: 1px solid #333; color: #e1e1e6; padding: 0.75rem; border-radius: 6px; outline: none;  }  .todo-input[data-h-todo-list]:focus {  border-color: #04d361;  }  .todo-btn[data-h-todo-list] {  background: #04d361; color: #000; border: none; padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s;  }  .todo-btn[data-h-todo-list]:hover {  opacity: 0.9;  }  .todo-btn.danger[data-h-todo-list] {  background: #ff4444; color: white;  }  .todo-filters[data-h-todo-list] {  display: flex; gap: 0.5rem; margin-bottom: 1rem;  }  .filter-btn[data-h-todo-list] {  background: #232326; color: #888; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; transition: all 0.2s;  }  .filter-btn[data-h-todo-list]:hover {  color: #e1e1e6;  }  .filter-btn.active[data-h-todo-list] {  background: #04d361; color: #000;  }  .todo-list[data-h-todo-list] {  list-style: none; padding: 0; margin: 0; max-height: 400px; overflow-y: auto;  }  .todo-item[data-h-todo-list] {  display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #1c1c1f; margin-bottom: 0.5rem; border-radius: 6px; border-left: 3px solid #04d361; transition: all 0.2s;  }  .todo-item.completed[data-h-todo-list] {  opacity: 0.5; border-left-color: #555;  }  .todo-item.completed[data-h-todo-list] .todo-text {  text-decoration: line-through; color: #888;  }  .todo-toggle[data-h-todo-list] {  width: 20px; height: 20px; cursor: pointer; accent-color: #04d361;  }  .todo-text[data-h-todo-list] {  flex: 1; color: #e1e1e6;  }  .btn-delete[data-h-todo-list] {  background: transparent; border: none; color: #ff4444; cursor: pointer; font-size: 1.2rem; padding: 0.25rem;  }  .btn-delete[data-h-todo-list]:hover {  transform: scale(1.1);  }  .todo-footer[data-h-todo-list] {  display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #232326; color: #888; font-size: 0.9rem;  }  .empty-state[data-h-todo-list] {  text-align: center; color: #555; padding: 2rem; font-style: italic;  }`;
_sfc_main.render = function(context, instanceId) {
    const fragment = tpl.content.cloneNode(true);
    const root = fragment.firstElementChild;

    {
        const targetEl = root.childNodes[0].childNodes[0];
        if (context.inputValue !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.inputValue, instanceId);
        }
    }
    {
        const targetEl = root.childNodes[2].childNodes[0];
        if (context.isEmpty !== undefined) {
            registerSink(targetEl, SINK_TYPE_SHOW, context.isEmpty, instanceId);
        }
    }
    if (context.filteredTodos !== undefined) {
        registerListSink(root.childNodes[3].childNodes[0], context.filteredTodos, 'id', 'todo', instanceId, compileDirectives);
    }
    {
        const targetEl = root.childNodes[4].childNodes[0].childNodes[1];
        if (context.activeCount !== undefined) {
            registerSink(targetEl, SINK_TYPE_TEXT, context.activeCount, instanceId);
        }
    }

    return fragment;
};

export const TodoListComponent = _sfc_main;
