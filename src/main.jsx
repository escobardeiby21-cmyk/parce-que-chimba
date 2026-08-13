import React, { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Rendering Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h1 style={{ color: '#ff6b00', fontSize: '26px', fontWeight: 'bold', marginBottom: '10px' }}>PARCE QUE CHIMBA 🇨🇴🇪🇸</h1>
          <p style={{ margin: '10px 0 20px 0', fontSize: '14px', color: '#ccc', maxWidth: '360px' }}>
            Accediendo al menú y al panel de administración...
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              style={{ backgroundColor: '#ff6b00', color: '#000', border: 'none', padding: '14px 20px', borderRadius: '14px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
            >
              📊 Cargar Menú y Panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
