// Arquivo: src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Importa nosso componente principal App.js

// 1. Encontra a div com o id 'root' no nosso arquivo public/index.html
const rootElement = document.getElementById('root');

// 2. Cria a raiz da aplicação React nessa div
const root = ReactDOM.createRoot(rootElement);

// 3. Renderiza (desenha) nosso componente <App /> dentro da div 'root'
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
