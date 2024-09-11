let sidebarPort;
let tabsByDomain = {};

function getDomain(url) {
  try {
    let hostname = new URL(url).hostname;
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch (error) {
    console.error("Invalid URL:", url);
    return "unknown";
  }
}

function updateTabsByDomain() {
  return browser.tabs.query({}).then((tabs) => {
    tabsByDomain = {};
    tabs.forEach((tab) => {
      let domain = getDomain(tab.url);
      if (!tabsByDomain[domain]) {
        tabsByDomain[domain] = {
          tabs: [],
          favicon: tab.favIconUrl || null
        };
      }
      tabsByDomain[domain].tabs.push(tab);
      // Update favicon if it's not set and the current tab has one
      if (!tabsByDomain[domain].favicon && tab.favIconUrl) {
        tabsByDomain[domain].favicon = tab.favIconUrl;
      }
    });
    sendUpdate();
  });
}

function sendUpdate() {
  if (sidebarPort) {
    sidebarPort.postMessage({
      action: "updateSidebar",
      data: tabsByDomain
    });
  }
}

function handleTabRemoved(tabId, removeInfo) {
  let domainToRemove = null;
  for (let domain in tabsByDomain) {
    tabsByDomain[domain].tabs = tabsByDomain[domain].tabs.filter(tab => tab.id !== tabId);
    if (tabsByDomain[domain].tabs.length === 0) {
      domainToRemove = domain;
    }
  }
  if (domainToRemove) {
    delete tabsByDomain[domainToRemove];
  }
  sendUpdate();
}

function handleTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    updateTabsByDomain();
  }
}

browser.tabs.onUpdated.addListener(handleTabUpdated);
browser.tabs.onMoved.addListener(updateTabsByDomain);
browser.tabs.onCreated.addListener(updateTabsByDomain);
browser.tabs.onRemoved.addListener(handleTabRemoved);
browser.tabs.onActivated.addListener(updateTabsByDomain);
browser.windows.onFocusChanged.addListener(updateTabsByDomain);

browser.runtime.onConnect.addListener((port) => {
  sidebarPort = port;
  port.onMessage.addListener((message) => {
    if (message.action === "requestInitialData") {
      updateTabsByDomain();
    }
  });
  port.onDisconnect.addListener(() => {
    sidebarPort = null;
  });
});

browser.runtime.onStartup.addListener(updateTabsByDomain);
browser.runtime.onInstalled.addListener(updateTabsByDomain);