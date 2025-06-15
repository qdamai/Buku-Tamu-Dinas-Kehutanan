const { contextBridge, ipcRenderer } = require('electron');

// Definisikan API yang akan diekspos ke renderer process
const electronAPI = {
    // Fungsi untuk data tamu
    getTamu: () => ipcRenderer.invoke('get-tamu'),
    addTamu: (tamu) => ipcRenderer.invoke('add-tamu', tamu),
    updateTamu: (tamu) => ipcRenderer.invoke('update-tamu', tamu),
    deleteTamu: (id) => ipcRenderer.invoke('delete-tamu', id),
    
    // Fungsi untuk export
    exportCSV: (content, fileName) => ipcRenderer.invoke('export-csv', content, fileName),
    exportPDF: () => ipcRenderer.invoke('export-pdf'),
    
    // Fungsi untuk notifikasi
    showNotification: (title, message) => ipcRenderer.invoke('show-notification', title, message)
};

// Ekspos API ke renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Log untuk debugging
console.log('Preload script loaded');
console.log('Available APIs:', Object.keys(electronAPI)); 