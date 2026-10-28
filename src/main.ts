// overfin-web starts here.
import { addMissing } from './lib/older';
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { quietScrollbar } from './lib/scrollbar';
import { loadBrand } from './lib/brand.svelte';
import { applyTheme, rememberedTheme } from './lib/theme';

// What an older browser lacks, before anything uses it.
addMissing();

// The look this browser last had, until the profile is known.
applyTheme(rememberedTheme());
loadBrand();

mount(App, { target: document.getElementById('app')! });
quietScrollbar();
