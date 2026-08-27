/**
/* main.js
/* BoxPathGetter - Getting Box's absolute path from shared url. -
**/

"use strict";

// Constants
const WINDOW_WIDTH = 1200; // window width
const WINDOW_HEIGHT = 1000; // window height
const IGNORE_CERT_ERROR = '--ignore-certificate-errors'; // ignore cert-errors
const ALLOW_INSECURE = '--allow-running-insecure-content'; // allow insecure content
const NO_SANDBOX = '--no-sandbox'; // no sandbox
const DISABLE_SANDBOX = '--disable-setuid-sandbox'; // no setup sandbox
const DISABLE_EXTENSIONS = '--disable-extensions'; // disable extension
const DEFAULT_ENCODING = 'utf8'; // encoding
const CSV_ENCODING = 'Shift_JIS'; // csv encoding
const COMPLETE_MESSAGE1 = '絶対パス取得が完了しました。'; // comp popup1
const COMPLETE_MESSAGE2 = 'クリップボードへコピーしました。'; // comp popup2
const USER_ROOT_PATH = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"]; // user path
const CHROME_EXEC_PATH1 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'; // chrome.exe path1
const CHROME_EXEC_PATH2 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // chrome.exe path2
const CHROME_EXEC_PATH3 = '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'; // chrome.exe path3
const FIRST_URL = '****';
const CHOOSE_FILE = '読み込むCSVを選択してください。'; // file dialog

// Modules
const { app, BrowserWindow, dialog, ipcMain, clipboard, session } = require('electron'); // Electron
const fs = require('fs'); // File operator
const path = require("path"); // Path
const parse = require('csv-parse/lib/sync'); // CSV parser
const iconv = require('iconv-lite'); // Text converter
const cryptoJS = require("crypto-js"); // Crypto
const puppeteer = require('puppeteer-core'); // Puppeteer for scraping
const log = require('electron-log').create("main"); // Logger
const Store = require('electron-store'); // Electron-store
const p = require('./package.json');
require('date-utils'); // Date-utils

// global variables
let globalLoginId = ""; // login id
let globalLoginPass = ""; // login pass
let globalSecretWd = ""; // secret word
let globalMainWindow = null; // main window
let globalResultPathArray = []; // absolute path array

// storage
const store = new Store();

// turn security warnig off
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';

// main
app.on('ready', async() => {
    // Electron window
    globalMainWindow = await new BrowserWindow({
        width: WINDOW_WIDTH, // window width
        height: WINDOW_HEIGHT, // window height
        defaultEncoding: DEFAULT_ENCODING, // encoding
        webPreferences: {
            contextIsolation: true, // context isolation
            preload: `${__dirname}/js/preload.js`, // preload file
        },
    });
    // hide menu bar
    await globalMainWindow.setMenu(null);
    // main html
    await globalMainWindow.loadURL(`file://${__dirname}/index.html`);
    // for dev
    // await globalMainWindow.webContents.openDevTools();

    // initialize
    await globalMainWindow.on('ready-to-show', async() => {
        // version
        const appVersion = await p.version ?? '0.0.0';
        // make log directory
        await directoryMaker(path.join(__dirname, '..', '..', 'logs'));
        // auth infos
        globalLoginId = await store.get('user_id') ?? ''; // user ssid
        globalLoginPass = await store.get('user_password') ?? ''; // user pass
        globalSecretWd = await store.get('secret') ?? ''; // secret
        // sending obj
        const initObj = {
          "secret": globalSecretWd, // secret
          "version": appVersion, // app version
        }
        // be ready
        globalMainWindow.send("ready", initObj);
    });

    // be ready
    ipcMain.on('go', async(event, arg) => {
        // define variable
        let authObj = {}; // auth object

        // encrypt pass
        const tmpAuthLoginPass = await cryptoJS.AES.encrypt(globalLoginPass, globalSecretWd);
        // stringify
        const lastAuthLoginPass = await tmpAuthLoginPass.toString();
        // auth data
        authObj = {
            "id": globalLoginId, // user id
            "pass": lastAuthLoginPass, // user password
        }
        // send authentication data
        globalMainWindow.send("auth", authObj);
    });

    // set secret
    ipcMain.on('secret', (event, arg) => {
        try {
            // set variable
            globalSecretWd = arg;
            // store secret
            store.set('secret', globalSecretWd);
            // reply
            event.reply('secret-reply', 'ok');
        } catch(e) {
            // error logging
            logEverywhere(globalMainWindow, '1-1: ipc secret error', e);
        }
    });

    // clear data
    ipcMain.on('clear', (event, arg) => {
        try {
            // clear array
            globalResultPathArray = [];
        } catch(e) {
            // error logging
            logEverywhere(globalMainWindow, '1-2: ipc clear error', e);
        }
    });

    // operation started
    ipcMain.on('login', async(event, arg) => {
        // variables
        let tmpRecords; // records
        let str = ''; // for encode
        let filenames = []; // filename
        let initialFlg = false; // initial loop flg
        let errorFlg = false; // error flg

        // json parse
        const targetObj = await JSON.parse(JSON.stringify(arg));
        // decrypt login password
        const tmpLoginPass = await cryptoJS.AES.decrypt(targetObj.pass, globalSecretWd);
        // set variables globally
        globalLoginId = targetObj.id;
        // stringify
        globalLoginPass = tmpLoginPass.toString(cryptoJS.enc.Utf8);
        // store authentication data
        await store.set('user_id', globalLoginId); // login id
        await store.set('user_password', globalLoginPass); // login pass

        // csv file dialog
        await getCsvData()
            .then(res => {
                // file name
                filenames = res;
            }).catch(e => {
                // error logging
                logEverywhere(globalMainWindow, '2-1: csv reading error', e);
            });

        // file reading
        await fs.readFile(filenames[0], async(err, data) => {
            // variables
            let i = 0; // loop
            let resObjId = 0;
            let result = ''; // scraping result
            let resultStr = ''; // result string
            let resObj = {}; // sending data

            // error
            if(err) {
                // error logging
                logEverywhere(globalMainWindow, '3: file system error', err);
            }

            // launch puppeteer
            const browser = await puppeteer.launch({
                headless: true, // no display mode
                executablePath: await getChromePath(), // chrome.exe path
                ignoreDefaultArgs: [DISABLE_EXTENSIONS], // ignore extensions
                args: [ALLOW_INSECURE, NO_SANDBOX, DISABLE_EXTENSIONS, DISABLE_SANDBOX], // args
            }).catch(e => {
                // error logging
                logEverywhere(globalMainWindow, '6-1: puppeteer browser error', e);
            });

            // decode csv
            try {
                // decoder
                str = await iconv.decode(data, CSV_ENCODING);
            } catch(e) {
                // error logging
                logEverywhere(globalMainWindow, '7: encoding error', e);
            };

            // csv reading
            tmpRecords = await parse(str, {
                columns: false, // no specified columns
                from_line: 2, // from line 2
                skip_lines_with_empty_values: true, // skip blank cell
            }, e => {
                // error logging
                logEverywhere(globalMainWindow, '2-2: csv parsing error', e);
            });

            // reg
            const re = new RegExp("^*****", "i");
            // extract only second column
            const records = await tmpRecords.map(item => item[1]);
            // initialize page
            const page = await browser.newPage(); // create page
            // loop targetURL
            for(i = 0; i < records.length; i++) {
                try {
                    // initialize flgs
                    errorFlg = false;
                    // if https://*****~
                    if(re.test(records[i])) {
                        // goto page
                        await page.goto(records[i], {waitUntil: 'domcontentloaded'});
                        // initial loop
                        if(!initialFlg) {
                            // only first loop
                            initialFlg = true;
                            // wait for continue button
                            await page.waitForSelector(".login-link-sso button", {timeout: 10000}).then(() => {
                                // finished loading
                                const isLoadingSucceeded = page.$(".login-link-sso button").then(res => !!res);
                                // continue
                                if(isLoadingSucceeded) {
                                    // click continue button
                                    clickButtonSync(page, ".login-link-sso button");
                                } else {
                                    // no continue button
                                    throw new Error('no continue button exists');
                                }
                            }).catch(e => {
                                // error logging
                                logEverywhere(globalMainWindow, '4-1: scraping evaluate error', e);
                                // show dialog
                                showErrorDialog(e.toString());
                                // close browser
                                browser.close();
                            }); 
                            // wait loading
                            await page.waitForSelector("#loginBtnAct", {timeout: 10000}).then(async() => {
                                // finished loading
                                const isLoadingSucceeded = await page.$("#loginBtnAct").then(res => !!res);
                                // login
                                if(isLoadingSucceeded) {
                                    // enter user id
                                    await page.type("#user_id", globalLoginId);
                                    // enter user password
                                    await page.type("#user_pw", globalLoginPass);
                                    // click login button
                                    await clickButtonSync(page, "#loginBtnAct");
                                } else {
                                    // no login button
                                    throw new Error('no login button exists');
                                }
                            }).catch(e => {
                                // error logging
                                logEverywhere(globalMainWindow, '4-1: scraping evaluate error', e);
                                // show dialog
                                showErrorDialog(e.toString());
                                // close browser
                                browser.close();
                            }); 
                        }
                        // wait loading
                        await page.waitForSelector('body textarea:last-of-type', {timeout: 10000}).then(async() => {
                            // finished loading
                            const isLoadingSucceeded = await page.$("body textarea:last-of-type").then(res => !!res);
                            // get script
                            if(isLoadingSucceeded) {
                                // extract script
                                result = await page.evaluate(selector => {
                                    // check script tag
                                    return Array.prototype.map.call(
                                        document.querySelectorAll(selector),
                                        el => el.textContent
                                    )
                                }, 'script')
                                // target script
                                resultStr = await result[result.length - 1];
                            } else {
                                // no login button
                                throw new Error('no script exists');
                            }
                        }).catch(e => {
                            // error logging
                            logEverywhere(globalMainWindow, '4-3: scraping evaluate error', `row${i + 1}: no data exists.`);   
                            errorFlg = true; 
                        });
                        // resObj ID
                        resObjId = 1;
                    } else {
                        // resObj ID
                        resObjId = 2;
                    }
                } catch(e) {
                    // flg on
                    errorFlg = true;
                    // error logging
                    logEverywhere(globalMainWindow, '4-2: scraping evaluate error', e);
                } finally {
                    // if error flg on
                    if(errorFlg) {
                        // resObj ID
                        resObjId = 3;
                    }
                    switch (resObjId) {
                        case 0:
                            logEverywhere(globalMainWindow, '4-4: scraping evaluate error', 'no data');
                            break;
                        case 1:
                            resObj = {
                                "str": resultStr, // message
                                "nodata": false, // nodata or not
                            }
                            break;
                        case 2:
                            resObj = {
                                "str": records[i], // message
                                "nodata": true, // nodata or not
                            }
                            break;
                        case 3:
                            resObj = {
                                "str": '', // message
                                "nodata": false, // nodata or not
                            }
                            break;
                        default:
                            logEverywhere(globalMainWindow, '4-4: scraping evaluate error', 'no data');
                            break;
                    }
                    // last loop
                    if(i == records.length - 1) {
                        // last flg on
                        resObj["flg"] = true;
                    } else {
                        // last flg off
                        resObj["flg"] = false;
                    }
                    // give script to renderer
                    await globalMainWindow.send("openfile", resObj);
                }
            }
        });
    });

    // path
    ipcMain.on('path', (event, arg) => {
        try {
            // recieved data
            const targetObj = JSON.parse(JSON.stringify(arg));
            // add to array
            globalResultPathArray.push(targetObj.result);
            // when flg true
            if(targetObj.flg) {
                // copy to clipboard
                clipboard.writeText(globalResultPathArray.join('\n'));
                // show complete dialog
                const options = {
                  type: 'info', // dialog type
                  title: 'completed', // dialog title
                  message: COMPLETE_MESSAGE1, // dialog message
                  detail: COMPLETE_MESSAGE1 + COMPLETE_MESSAGE2, // dialog detail
                }
                // show dialog
                dialog.showMessageBox(options);
                globalMainWindow.focus();
            }
        } catch(e) {
            // error logging
            logEverywhere(globalMainWindow, '1-3: ipc path error', e);
        }
    });

    // dialog
    ipcMain.on('dialog', (event, arg) => {
        try {
            // show dialog
            const options = {
              type: 'info', // dialog type
              title: 'dialog', // dialog title
              message: arg, // dialog message
            }
            // show dialog
            dialog.showMessageBox(options);
        } catch(e) {
            // error logging
            logEverywhere(globalMainWindow, '1-4: ipc path error', e);
        }
    });

    // error
    ipcMain.on('error', (event, arg) => {
        // error logging
        logEverywhere(globalMainWindow, 'x: browser error', arg);
    });

    // closing
    globalMainWindow.on('closed', () => {
        try {
            // clear cache
            session.defaultSession.clearCache(() => {});
            // release window
            globalMainWindow = null;
        } catch(e) {
            // error logging
            logEverywhere(globalMainWindow, '6-2: puppeteer browser error', e);
        }
    });
});

// choose csv data
const getCsvData = () => {
    return new Promise((resolve, reject) => {
        // show file dialog
        dialog.showOpenDialog(null, {
            properties: ['openFile'], // file open
            title: CHOOSE_FILE, // header title
            defaultPath: '.', // default path
            filters: [
                {name: 'csv(Shif-JIS)', extensions: ['csv']} // csv only
            ],
        }).then(result => {
            // file exists
            if(result.filePaths) {
                resolve(result.filePaths);
            // no file
            } else {
                reject(result.canceled);
            }
        }).catch(err => {
            // error logging
            logEverywhere(globalMainWindow, '2-3: csv file select error', e);
        });
    });
}

// sync button click
const clickButtonSync = async(page, selector) => {
    try {
        const button = await page.$(selector);
        const promises = await [
            // wait loading
            page.waitForSelector(selector, {timeout: 5000}),
            // define
            button,
            // push button
            button.click(),
        ];
        await Promise.all(promises);
    } catch(e) {
        // error logging
        logEverywhere(globalMainWindow, '4-5: scraping evaluate error', e);
    }
}

// data logger
const logEverywhere = (window, no, message) => {
    try {
        // now
        const dt = new Date();
        // format date
        const formattedDate = dt.toFormat('YYYYMMDD');
        // log dir
        const outputDir = path.join(__dirname, '..', '..', 'logs');
        // log file name
        const filename = formattedDate + '.log';
        // window exists
        if(window && window.webContents) {
            // execute script both main and browser windows
            window.webContents.executeJavaScript(`console.log(\"${no}: ${message}\")`);
            // display error
            window.webContents.executeJavaScript(`document.getElementById("error").innerHTML = \"${no}: ${message}\"`);
            // file output
            log.transports.file.file = path.join(outputDir, filename);
            // logging message
            log.info(`${no}: ${message}`);
        }
    } catch(e) {
        // error logging
        logEverywhere(globalMainWindow, '9: logging error', e);
    }
}

// make directory
const directoryMaker = dir => {
    // if no dir exist
    try {
        if(!fs.existsSync(dir)) {
            // make directory
            fs.mkdirSync(dir, { recursive: false });
        }
    } catch(e) {
        // error logging
        logEverywhere(globalMainWindow, '5: make directory error', e);
    }
}

// get chrome absolute path
const getChromePath = () => {
    // chrome tmp path
    const tmpPath = path.join(USER_ROOT_PATH, CHROME_EXEC_PATH3);
    // 32bit
    if(fs.existsSync(CHROME_EXEC_PATH1)) {
        return CHROME_EXEC_PATH1;
    // 64bit
    } else if(fs.existsSync(CHROME_EXEC_PATH2)) {
        return CHROME_EXEC_PATH2;
    // user path
    } else if(fs.existsSync(tmpPath)) {
        return tmpPath;
    // error
    } else {
        // error logging
        logEverywhere(globalMainWindow, '8: no chrome path error', e);
    }
}

// show dialog
const showErrorDialog = msg => {
    try {
        // show dialog
        const options = {
          type: 'error', // dialog type
          title: 'dialog', // dialog title
          message: msg, // dialog message
        }
        // show dialog
        dialog.showMessageBox(options);
    } catch(e) {
        // error logging
        logEverywhere(globalMainWindow, '9: dialog error', e);
    }
}
