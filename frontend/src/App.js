// src/App.js
import React, { useState } from 'react';

function App() {
  const [folderFiles, setFolderFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFolderChange = (event) => {
    
    setFolderFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (folderFiles.length === 0) {
      alert("Selectează un folder care conține PDF-uri!");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    
    
    for (let i = 0; i < folderFiles.length; i++) {
      formData.append('documents', folderFiles[i]);
    }

    try {
      const response = await fetch('http://localhost:5000/api/upload-folder', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResults(data); 
    } catch (error) {
      console.error("Eroare:", error);
      alert("Eroare la comunicarea cu serverul.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <h1 style={{ color: '#2c3e50' }}>Inventariere Automată Folder (PDF)</h1>
      
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <p>Alege un folder pentru a extrage automat datele din PDF-uri:</p>
        <input 
          type="file" 
          webkitdirectory="" 
          directory="" 
          multiple 
          onChange={handleFolderChange}
          style={{ marginBottom: '10px' }}
        />
        <br />
        <button 
          onClick={handleUpload} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Se analizează folderul...' : 'Începe Inventarierea'}
        </button>
      </div>

      <div style={{ marginTop: '30px' }}>
        {results.length > 0 && <h2>Documente Inventariate:</h2>}
        
        {results.map((doc, index) => (
          <div key={index} style={{ 
            backgroundColor: 'white', 
            margin: '15px 0', 
            padding: '20px', 
            borderRadius: '8px',
            borderLeft: '5px solid #3498db',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2980b9' }}>{doc.nume_fisier}</h3>
            {doc.eroare ? (
              <p style={{ color: 'red' }}>{doc.eroare}</p>
            ) : (
              <>
                <p><strong>Subiect:</strong> {doc.subiect}</p>
                <p><strong>Autor:</strong> {doc.autor}</p>
                <p><strong>Data:</strong> {doc.data_crearii}</p>
                <p><strong>Rezumat:</strong> {doc.rezumat}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;