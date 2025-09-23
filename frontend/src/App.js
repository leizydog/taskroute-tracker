import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [message, setMessage] = useState('Loading...');
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:8000/')
      .then(response => {
        setMessage(response.data.message);
      })
      .catch(error => {
        console.error('Error:', error);
        setError('Failed to connect to backend');
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>TaskRoute Tracker</h1>
        {error ? (
          <p style={{color: 'red'}}>{error}</p>
        ) : (
          <p>{message}</p>
        )}
        <p>Frontend is running on port 3000</p>
        <p>Backend should be running on port 8000</p>
      </header>
    </div>
  );
}

export default App;
