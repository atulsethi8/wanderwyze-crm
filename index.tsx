import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { InvoiceForm } from './components/InvoiceForm';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/form" element={<InvoiceForm />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);