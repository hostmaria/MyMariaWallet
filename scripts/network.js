'use strict';

function networkError() {
    if (disableNetwork()) {
        createAlert('warning',
                    '<b>Failed to synchronize!</b> Please try again later.' +
                    '<br>You can attempt re-connect via the Settings.');
    }
}

if (networkEnabled) {
  var getBlockCount = function() {
    var request = new XMLHttpRequest();
    request.open('GET', cExplorer.url + "/api/v2/api", true);
    request.onerror = networkError;
    request.onload = function () {
      const data = JSON.parse(this.response);
      // If the block count has changed, refresh all of our data!
      domBalanceReload.classList.remove("playAnim");
      domBalanceReloadStaking.classList.remove("playAnim");
      if (data.backend.blocks > cachedBlockCount) {
        console.log("New block detected! " + cachedBlockCount + " --> " + data.backend.blocks);
        getUTXOs();
      }
      cachedBlockCount = data.backend.blocks;
    }
    request.send();
  }

  var arrUTXOsToValidate = [], nTimeSyncStart = 0;
  var acceptUTXO = () => {
    // Cancel if the queue is empty: no wasting precious bandwidth & CPU cycles!
    if (!arrUTXOsToValidate.length) {
      // If allowed by settings: submit a sync performance measurement to Labs Analytics
      return submitAnalytics('time_to_sync', { time: (Date.now() / 1000) - nTimeSyncStart, explorer: cExplorer.name });
    }

    const request = new XMLHttpRequest();
    request.open('GET', cExplorer.url + "/api/v2/tx-specific/" + arrUTXOsToValidate[0].txid, true);
    request.onerror = networkError;

    request.onload = function() {
      // Fetch the single output of the UTXO
      const cVout = JSON.parse(this.response).vout[arrUTXOsToValidate[0].vout];

      // Convert to MPW format
      const cUTXO = {
        'id': arrUTXOsToValidate[0].txid,
        'vout': cVout.n,
        'sats': Math.round(cVout.value * COIN),
        'script': cVout.scriptPubKey.hex
      }

      // Determine the UTXO type, and use it accordingly
      if (cVout.scriptPubKey.type === 'pubkeyhash') {
        // P2PKH type (Pay-To-Pub-Key-Hash)
        cachedUTXOs.push(cUTXO);
      } else
      if (cVout.scriptPubKey.type === 'coldstake') {
        // Cold Stake type
        arrDelegatedUTXOs.push(cUTXO);
      }

      // Shift the queue and update the UI
      getBalance(true);
      getStakingBalance(true);
      
      // Loop validation until queue is empty
      arrUTXOsToValidate.shift();
      acceptUTXO();
    }
    request.send();
  }

  var getUTXOs = () => {
    // Don't fetch UTXOs if we're already scanning for them!
    if (arrUTXOsToValidate.length) return;

    const request = new XMLHttpRequest()
    request.open('GET', cExplorer.url + "/api/v2/utxo/" + publicKeyForNetwork, true);
    request.onerror = networkError;
    request.onload = function() {
      arrUTXOsToValidate = JSON.parse(this.response);
      // Clear our UTXOs and begin accepting refreshed ones (TODO: build an efficient 'set merge' algo)
      cachedUTXOs = []; arrDelegatedUTXOs = [];
      if (arrUTXOsToValidate.length) {
        nTimeSyncStart = Date.now() / 1000;
        acceptUTXO();
      }
    }
    request.send();
  }

var sendTransaction = function(hex, msg = '') {
    const request = new XMLHttpRequest();
    request.open('GET', cExplorer.url + "/api/v2/sendtx/" + hex, true);
    request.onerror = networkError;
    request.onreadystatechange = function () {
        if (!this.response || (!this.status === 200 && !this.status === 400)) return;
        if (this.readyState !== 4) return;
        const data = JSON.parse(this.response);
        if (data.result && data.result.length === 64) {
            console.log('Transaction sent! ' + data.result);
            if (domAddress1s.value !== donationAddress)
                domTxOutput.innerHTML = ('<h4 style="color:green; font-family:mono !important;">' + data.result + '</h4>');
            else
                domTxOutput.innerHTML = ('<h4 style="color:green">Thank you for supporting MyPIVXWallet! 💜💜💜<br><span style="font-family:mono !important">' + data.result + '</span></h4>');
            domSimpleTXs.style.display = 'none';
            domAddress1s.value = '';
            domValue1s.innerHTML = '';
            createAlert('success', msg || 'Transaction sent!', msg ? (1250 + (msg.length * 50)) : 1500);

            // If allowed by settings: submit a simple 'tx' ping to Labs Analytics
            submitAnalytics('transaction');
        } else {
            console.log('Error sending transaction: ' + data.result);
            createAlert('warning', 'Transaction Failed!', 1250);
            // Attempt to parse and prettify JSON (if any), otherwise, display the raw output.
            let strError = data.error;
            try {
                strError = JSON.stringify(JSON.parse(data), null, 4);
                console.log('parsed');
            } catch(e){console.log('no parse!'); console.log(e);}
            domTxOutput.innerHTML = '<h4 style="color:red;font-family:mono !important;"><pre style="color: inherit;">' + strError + "</pre></h4>";
        }
    }
    request.send();
}

  var getFee = function (bytes) {
    // TEMPORARY: Hardcoded fee per-byte
    return bytes * 50; // 50 sat/byte
  }
}

// MARIA Labs Analytics: if you are a user, you can disable this FULLY via the Settings.
// ... if you're a developer, we ask you to keep these stats to enhance upstream development,
// ... but you are free to completely strip MPW of any analytics, if you wish, no hard feelings.
var submitAnalytics = function (strType, cData = {}) {
    if (!networkEnabled) return;

    // Limit analytics here to prevent 'leakage' even if stats are implemented incorrectly or forced
    let i = 0, arrAllowedKeys = [];
    for (i; i < cAnalyticsLevel.stats.length; i++) {
      const cStat = cAnalyticsLevel.stats[i];
      arrAllowedKeys.push(cStatKeys.find(a => STATS[a] === cStat));
    }

    // Check if this 'stat type' was granted permissions
    if (!arrAllowedKeys.includes(strType)) return false;

    // Format
    const cStats = {'type': strType, ...cData};

    // Send to Labs Analytics
    const request = new XMLHttpRequest();
    request.open('POST', "https://scpscan.net/mpw/statistic", true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(JSON.stringify(cStats));
    return true;
}