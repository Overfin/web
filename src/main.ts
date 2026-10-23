// overfin-web starts here.
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { quietScrollbar } from './lib/scrollbar';

mount(App, { target: document.getElementById('app')! });
quietScrollbar();
