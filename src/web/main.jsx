import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './stil.css';

createRoot(document.getElementById('kok')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
