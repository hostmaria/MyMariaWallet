'use strict';

// --- Default Settings
var debug = false;
var networkEnabled = true;

// A list of Labs-trusted explorers
const arrExplorers = [
    // Display name      Blockbook-compatible API base
    { name: "maria",   url: "https://explorer.mariacoin.com" }
]

var cExplorer = arrExplorers[0];

// A list of statistic keys and their descriptions
const STATS = {
    // Stat key   // Description of the stat, it's data, and it's purpose
    hit:          "A ping indicating an app load, no unique data is sent.",
    time_to_sync: "The time in seconds it took for MPW to last synchronise.",
    transaction:  "A ping indicating a Tx, no unique data is sent, but may be inferred from on-chain time."
}
Object.freeze(STATS);

const cStatKeys = Object.keys(STATS);

// A list of Analytics 'levels' at which the user may set depending on their privacy preferences
const arrAnalytics = [
    // Statistic level  // Allowed statistics
    { name: "Disabled", stats: [] },
    { name: "Minimal",  stats: [STATS.hit, STATS.time_to_sync] },
    { name: "Balanced", stats: [STATS.hit, STATS.time_to_sync, STATS.transaction] }
]

var cAnalyticsLevel = arrAnalytics[2];

// Users need not look below here.
// ------------------------------
// Global Keystore / Wallet Information
var publicKeyForNetwork;
var privateKeyForTransactions;
var fWalletLoaded = false;

// --- DOM Cache
const domNetwork = document.getElementById('Network');
const domDebug = document.getElementById('Debug');

// Display the default settings directly in the UI
domNetwork.innerHTML = '<b> Network:</b> ' + (networkEnabled ? 'Enabled' : 'Disabled');
domDebug.innerText = debug ? '<b>DEBUG MODE ON</b>' : '';

// --- Settings Functions
function setExplorer(explorer, fSilent = false) {
    cExplorer = explorer;
    localStorage.setItem('explorer', explorer.url);

    // Enable networking + notify if allowed
    enableNetwork();
    if (!fSilent) createAlert('success', '<b>Switched explorer!</b><br>Now using ' + cExplorer.name, 2250);
}
// Hook up the 'explorer' select UI
document.getElementById('explorer').onchange = function(evt) {
    setExplorer(arrExplorers.find(a => a.url === evt.target.value));
}

function setAnalytics(level, fSilent = false) {
    cAnalyticsLevel = level;
    localStorage.setItem('analytics', level.name);
    // For total transparency, we'll 'describe' the various analytic keys of this chosen level
    let strDesc = '<center>--- Transparency Report ---</center><br>', i = 0;
    const nLongestKeyLen = cStatKeys.reduce((prev, e) => prev.length >= e.length ? prev : e).length;
    for (i; i < cAnalyticsLevel.stats.length; i++) {
        const cStat = cAnalyticsLevel.stats[i];
        // This formats Stat keys into { $key $(padding) $description }
        strDesc += cStatKeys.find(a => STATS[a] === cStat).padEnd(nLongestKeyLen, ' ') + ': ' + cStat + '<br>';
    }

    // Set display + notify if allowed
    domAnalyticsDescriptor.innerHTML = cAnalyticsLevel.name === arrAnalytics[0].name ? '' : '<h6 style="color:#dcdf6b;font-family:mono !important;"><pre style="color: inherit;">' + strDesc + '</pre></h6>';
    if (!fSilent) createAlert('success', '<b>Switched analytics level!</b><br>Now ' + cAnalyticsLevel.name, 2250);
}
// Hook up the 'analytics' select UI
document.getElementById('analytics').onchange = function(evt) {
    setAnalytics(arrAnalytics.find(a => a.name === evt.target.value));
}

function toggleDebug() {
    debug = !debug;
    domDebug.innerHTML = debug ? '<b>DEBUG MODE ON</b>' : '';
}

function toggleNetwork() {
    networkEnabled = !networkEnabled;
    domNetwork.innerHTML = '<b> Network:</b> ' + (networkEnabled ? 'Enabled' : 'Disabled');
    return networkEnabled;
}

// Enable the network, return true if successful.
function enableNetwork() {
    if (!networkEnabled) return toggleNetwork();
    return false;
}

// Disable the network, return true if successful.
function disableNetwork() {
    if (networkEnabled) return !toggleNetwork();
    return false;
}

// Once the DOM is ready; plug-in any settings to the UI
addEventListener('DOMContentLoaded', () => {
    const domExplorerSelect = document.getElementById('explorer');
    const domAnalyticsSelect = document.getElementById('analytics');

    // Add each trusted explorer into the UI selector
    for (const explorer of arrExplorers) {
        const opt = document.createElement('option');
        opt.value = explorer.url;
        opt.innerHTML = explorer.name + ' (' + explorer.url.replace('https://', '') + ')';
        domExplorerSelect.appendChild(opt);
    }

    // Add each analytics level into the UI selector
    for (const analLevel of arrAnalytics) {
        const opt = document.createElement('option');
        opt.value = opt.innerHTML = analLevel.name;
        domAnalyticsSelect.appendChild(opt);
    }

    // Fetch settings from LocalStorage
    const strSettingExplorer = localStorage.getItem('explorer');
    const strSettingAnalytics = localStorage.getItem('analytics');

    // For any that exist: load them, or use the defaults
    setExplorer(arrExplorers.find(a => a.url === strSettingExplorer) || cExplorer, true);

    // Honour the "Do Not Track" header by default
    if (!strSettingAnalytics && navigator.doNotTrack === "1") {
        // Disabled
        setAnalytics(arrAnalytics[0], true);
        domAnalyticsDescriptor.innerHTML = '<h6 style="color:#dcdf6b;font-family:mono !important;"><pre style="color: inherit;">Analytics disabled to honour "Do Not Track" browser setting, you may manually enable if desired, though!</pre></h6>';
    } else {
        // Load from storage, or use defaults
        setAnalytics(cAnalyticsLevel = arrAnalytics.find(a => a.name === strSettingAnalytics) || cAnalyticsLevel, true);
    }

    // And update the UI to reflect them
    domExplorerSelect.value = cExplorer.url;
    domAnalyticsSelect.value = cAnalyticsLevel.name;
});
