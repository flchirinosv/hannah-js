import { defineComponent, bootFramework } from './core/core.js';

// Dynamic import para code splitting
async function loadComponents() {
    // Cargar componentes en paralelo
    const [
        { CounterComponent },
        { TesterComponent },
        { UserCardComponent },
        { TodoListComponent },
        { ParentViewComponent },
        { ChildViewComponent },
        { ThemePanelComponent },
        { NewCounterComponent }
    ] = await Promise.all([
        import('./components/counter.js'),
        import('./components/tester.js'),
        import('./components/user-card.js'),
        import('./components/todo-list.js'),
        import('./components/parent-view.js'),
        import('./components/child-view.js'),
        import('./components/theme-panel.js'),
        import('./components/new-counter.js'),
    ]);
    
    // Registrar componentes
    defineComponent('counter', CounterComponent);
    defineComponent('tester', TesterComponent);
    defineComponent('user-card', UserCardComponent);
    defineComponent('todo-list', TodoListComponent);
    defineComponent('parent-view', ParentViewComponent);
    defineComponent('child-view', ChildViewComponent);
    defineComponent('theme-panel', ThemePanelComponent);
    defineComponent('new-counter', NewCounterComponent);
    
    // Arrancar el framework
    bootFramework();
}

// Iniciar la carga
loadComponents().catch(err => {
    console.error('❌ Error cargando componentes:', err);
});