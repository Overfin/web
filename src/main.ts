// overfin-web starts here.
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { quietScrollbar } from './lib/scrollbar';
import { loadBrand } from './lib/brand.svelte';
import { applyTheme, rememberedTheme } from './lib/theme';

// The look this browser last had, until the profile is known.
applyTheme(rememberedTheme());
loadBrand();

mount(App, { target: document.getElementById('app')! });
quietScrollbar();
