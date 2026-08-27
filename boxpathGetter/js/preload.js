/* preload.js, case 3 (final)*/
const { contextBridge, ipcRenderer} = require("electron");

// contextBridge
contextBridge.exposeInMainWorld(
    "api", {
        // send to ipcMain
        send: (channel, data) => { // send to ipcMain
            try {
                ipcRenderer.send(channel, data);   
            } catch (e) {     
                console.log(e);
            }    
        },
        // recieve from ipcMain
        on: (channel, func) => { //from ipcMain
            try {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            } catch (e) {    
                console.log(e);
            }    
        }
    }
);