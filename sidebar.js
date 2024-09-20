let domainStates = {};
let tabsByDomain = {};
let activeTabId = null;
let currentSearchTerm = '';
let isSearchFocused = false;
let stashStates = {};

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const createTabElement = (tab) => {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-200';
  tabElement.textContent = tab.title;
  tabElement.dataset.tabId = tab.id;
  tabElement.dataset.windowId = tab.windowId;
  tabElement.dataset.url = tab.url;
  
  if (tab.id === activeTabId) {
    tabElement.classList.add('active', 'bg-blue-200', 'dark:bg-blue-800');
  }
  
  tabElement.addEventListener('click', () => {
    browser.tabs.update(Number.parseInt(tab.id), { active: true })
      .then(() => {
        browser.windows.update(Number.parseInt(tab.windowId), { focused: true });
      })
      .catch((error) => console.error('Error switching tab:', error));
  });
  
  return tabElement;
};

const createDomainElement = (domain, domainData) => {
  const domainElement = document.createElement('div');
  domainElement.className = 'domain mb-2';
  domainElement.dataset.domain = domain;

  const domainTitle = document.createElement('div');
  domainTitle.className = 'domain-title p-2 bg-gray-200 dark:bg-gray-700 rounded-md cursor-pointer flex items-center';
  
  // Create favicon element
  const favicon = document.createElement('img');
  favicon.src = domainData.favicon || 'favicon.png';
  favicon.className = 'mr-2 w-4 h-4';
  favicon.onerror = () => {
    favicon.src = 'favicon.png';
  };

  // Create sort button
  const sortButton = document.createElement('button');
  sortButton.className = 'ml-2 p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50';
  sortButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" /></svg>';
  sortButton.title = 'Group all tabs for this domain together';
  sortButton.addEventListener('click', (e) => {
    e.stopPropagation();
    sortTabsForDomain(domain);
  });

  // Create new window button
  const newWindowButton = document.createElement('button');
  newWindowButton.className = 'ml-2 p-1 bg-green-500 text-white rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50';
  newWindowButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 2v10h12V5H4z" clip-rule="evenodd" /></svg>';
  newWindowButton.title = 'Open all tabs for this domain in a new window';
  newWindowButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openDomainInNewWindow(domain);
  });

  domainTitle.innerHTML = `
    <span class="fold-icon mr-2 transform transition-transform duration-200">${domainStates[domain] ? '' : ''}</span>
    <span class="domain-name flex-grow truncate">${domain}</span>
    <span class="tab-count text-sm text-gray-600 dark:text-gray-400">(${domainData.tabs.length})</span>
  `;
  domainTitle.insertBefore(favicon, domainTitle.firstChild);
  domainTitle.appendChild(sortButton);
  domainTitle.appendChild(newWindowButton);
  domainTitle.addEventListener('click', () => toggleDomain(domain));
  domainElement.appendChild(domainTitle);

  const tabList = document.createElement('div');
  tabList.className = `tab-list ml-4 mt-1 space-y-1 transition-all duration-200 ease-in-out ${domainStates[domain] ? 'hidden' : ''}`;
  const tabFragment = document.createDocumentFragment();
  domainData.tabs.forEach(tab => tabFragment.appendChild(createTabElement(tab)));
  tabList.appendChild(tabFragment);
  domainElement.appendChild(tabList);

  return domainElement;
};

const openDomainInNewWindow = (domain) => {
  const tabs = tabsByDomain[domain].tabs;
  const urls = tabs.map(tab => tab.url);
  
  browser.windows.create({ url: urls }).then(() => {
    // Optionally, close the tabs in the current window
    // Uncomment the following lines if you want to close the tabs in the current window
    const tabIds = tabs.map(tab => tab.id);
    browser.tabs.remove(tabIds);
  }).catch((error) => {
    console.error(`Error opening tabs for domain ${domain} in new window:`, error);
  });
};

const sortTabsForDomain = (domain) => {
  const tabs = tabsByDomain[domain].tabs;
  const currentWindowId = tabs[0].windowId;
  const tabIds = tabs.map(tab => tab.id);

  browser.tabs.move(tabIds, { windowId: currentWindowId, index: -1 })
    .then(() => {
      console.log(`Tabs for domain ${domain} have been sorted.`);
      refreshSidebar();
    })
    .catch((error) => {
      console.error(`Error sorting tabs for domain ${domain}:`, error);
    });
};


const toggleDomain = (domain) => {
  domainStates[domain] = !domainStates[domain];
  updateDomainView(domain);
};

const updateDomainView = (domain) => {
  const domainElement = document.querySelector(`.domain[data-domain="${domain}"]`);
  if (domainElement) {
    const tabList = domainElement.querySelector('.tab-list');
    const foldIcon = domainElement.querySelector('.fold-icon');
    if (tabList && foldIcon) {
      tabList.classList.toggle('hidden', domainStates[domain]);
      foldIcon.textContent = domainStates[domain] ? '' : '';
      foldIcon.style.transform = domainStates[domain] ? 'rotate(0deg)' : 'rotate(90deg)';
    }
  }
};

const updateSidebar = (newTabsByDomain) => {
  tabsByDomain = newTabsByDomain;
  
  Object.keys(domainStates).forEach(domain => {
    if (!tabsByDomain[domain]) {
      delete domainStates[domain];
    }
  });

  Object.keys(tabsByDomain).forEach(domain => {
    if (domainStates[domain] === undefined) {
      domainStates[domain] = false;
    }
  });

  const tabTree = document.getElementById('tab-tree');
  const fragment = document.createDocumentFragment();
  
  Object.keys(tabsByDomain).sort((a, b) => a.localeCompare(b)).forEach(domain => {
    fragment.appendChild(createDomainElement(domain, tabsByDomain[domain]));
  });
  
  tabTree.innerHTML = '';
  tabTree.appendChild(fragment);

  updateActiveTab();
  
  if (currentSearchTerm) {
    filterTabs(currentSearchTerm);
  } else {
    updateTotalTabCount();
  }
};
const updateActiveTab = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) {
      const newActiveTabId = tabs[0].id;
      if (newActiveTabId !== activeTabId) {
        const prevActiveTab = document.querySelector('.tab.active');
        if (prevActiveTab) {
          prevActiveTab.classList.remove('active', 'bg-blue-200', 'dark:bg-blue-800');
        }
        
        const newActiveTab = document.querySelector(`.tab[data-tab-id="${newActiveTabId}"]`);
        if (newActiveTab) {
          newActiveTab.classList.add('active', 'bg-blue-200', 'dark:bg-blue-800');
          if (!isSearchFocused) {
            newActiveTab.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
        
        activeTabId = newActiveTabId;
      }
    }
  });
};

const filterTabs = (searchTerm) => {
  currentSearchTerm = searchTerm.toLowerCase();
  let visibleTabCount = 0;

  document.querySelectorAll('.domain').forEach(domainElement => {
    let domainVisible = false;
    const domainTabs = domainElement.querySelectorAll('.tab');

    domainTabs.forEach(tabElement => {
      const tabTitle = tabElement.textContent.toLowerCase();
      const tabUrl = tabElement.dataset.url.toLowerCase();

      if (tabTitle.includes(currentSearchTerm) || tabUrl.includes(currentSearchTerm)) {
        tabElement.classList.remove('hidden');
        domainVisible = true;
        visibleTabCount++;
      } else {
        tabElement.classList.add('hidden');
      }
    });

    if (domainVisible) {
      domainElement.classList.remove('hidden');
      const visibleDomainTabs = domainElement.querySelectorAll('.tab:not(.hidden)');
      domainElement.querySelector('.tab-count').textContent = `(${visibleDomainTabs.length})`;
    } else {
      domainElement.classList.add('hidden');
    }
  });

  updateTotalTabCount(visibleTabCount);
};
const updateTotalTabCount = (visibleCount) => {
  const totalCount = Object.values(tabsByDomain).reduce((sum, domainData) => sum + domainData.tabs.length, 0);
  const totalCountElement = document.getElementById('total-tab-count');
  if (totalCountElement) {
    if (visibleCount !== undefined && visibleCount !== totalCount) {
      totalCountElement.textContent = `Showing ${visibleCount} of ${totalCount} tabs`;
    } else {
      totalCountElement.textContent = `Total tabs: ${totalCount}`;
    }
  }
};

const toggleAll = () => {
  const newState = !Object.values(domainStates).every(state => state);
  Object.keys(domainStates).forEach(domain => {
    domainStates[domain] = newState;
    updateDomainView(domain);
  });

  const toggleButton = document.getElementById('toggle-all');
  if (toggleButton) {
    toggleButton.innerHTML = newState ? 
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>' :
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>';
  }
};

const toggleDarkMode = () => {
  const isDarkMode = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDarkMode);

  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.innerHTML = isDarkMode ?
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" /></svg>' :
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>';
  }

  updateUIForDarkMode(isDarkMode);
};


const updateUIForDarkMode = (isDarkMode) => {
  document.body.classList.toggle('bg-gray-100', !isDarkMode);
  document.body.classList.toggle('text-gray-800', !isDarkMode);
  document.body.classList.toggle('dark:bg-gray-800', isDarkMode);
  document.body.classList.toggle('dark:text-gray-200', isDarkMode);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.classList.toggle('bg-white', !isDarkMode);
    searchInput.classList.toggle('dark:bg-gray-700', isDarkMode);
    searchInput.classList.toggle('dark:text-gray-200', isDarkMode);
    searchInput.classList.toggle('dark:border-gray-600', isDarkMode);
  }

  const toggleAllButton = document.getElementById('toggle-all');
  if (toggleAllButton) {
    toggleAllButton.classList.toggle('bg-blue-500', !isDarkMode);
    toggleAllButton.classList.toggle('hover:bg-blue-600', !isDarkMode);
    toggleAllButton.classList.toggle('dark:bg-blue-600', isDarkMode);
    toggleAllButton.classList.toggle('dark:hover:bg-blue-700', isDarkMode);
  }

  const githubLink = document.querySelector('a[href*="flaviohg.com"]');
  if (githubLink) {
    githubLink.classList.toggle('bg-gray-800', !isDarkMode);
    githubLink.classList.toggle('hover:bg-gray-700', !isDarkMode);
    githubLink.classList.toggle('dark:bg-gray-600', isDarkMode);
    githubLink.classList.toggle('dark:hover:bg-gray-500', isDarkMode);
  }
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.classList.toggle('bg-yellow-500', !isDarkMode);
    darkModeToggle.classList.toggle('hover:bg-yellow-600', !isDarkMode);
    darkModeToggle.classList.toggle('dark:bg-indigo-500', isDarkMode);
    darkModeToggle.classList.toggle('dark:hover:bg-indigo-600', isDarkMode);
  }

  document.querySelectorAll('.domain-title').forEach(el => {
    el.classList.toggle('bg-gray-200', !isDarkMode);
    el.classList.toggle('dark:bg-gray-700', isDarkMode);
  });

  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('hover:bg-gray-200', !isDarkMode);
    el.classList.toggle('dark:hover:bg-gray-700', isDarkMode);
  });

  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    activeTab.classList.toggle('bg-blue-200', !isDarkMode);
    activeTab.classList.toggle('dark:bg-blue-800', isDarkMode);
  }

  const totalTabCount = document.getElementById('total-tab-count');
  if (totalTabCount) {
    totalTabCount.classList.toggle('text-gray-600', !isDarkMode);
    totalTabCount.classList.toggle('dark:text-gray-400', isDarkMode);
  }
};

const initDarkMode = () => {
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  document.documentElement.classList.toggle('dark', savedDarkMode);
  updateUIForDarkMode(savedDarkMode);
};

const refreshSidebar = () => {
  const port = browser.runtime.connect({name: "sidebar"});
  port.postMessage({action: "requestInitialData"});
  port.onMessage.addListener((message) => {
    if (message.action === "updateSidebar") {
      updateSidebar(message.data);
    }
  });
};
const initializeSidebar = () => {
  initDarkMode();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const debouncedFilterTabs = debounce((searchTerm) => {
      filterTabs(searchTerm);
    }, 300);

    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      debouncedFilterTabs(currentSearchTerm);
    });

    searchInput.addEventListener('focus', () => {
      isSearchFocused = true;
      refreshSidebar();
    });

    searchInput.addEventListener('blur', () => {
      isSearchFocused = false;
    });
  }

  const stashButton = document.getElementById('stash-button');
  if (stashButton) {
    stashButton.addEventListener('click', saveStash);
  }

  browser.storage.local.get('stashes').then((result) => {
    stashes = result.stashes || [];
    updateStashList();
  });


  const toggleAllButton = document.getElementById('toggle-all');
  if (toggleAllButton) {
    toggleAllButton.addEventListener('click', toggleAll);
  }

  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }

  const refreshButton = document.getElementById('refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshSidebar);
  }

  const port = browser.runtime.connect({name: "sidebar"});
  port.onMessage.addListener((message) => {
    if (message.action === "updateSidebar") {
      updateSidebar(message.data);
    }
  });

  port.postMessage({action: "requestInitialData"});
};

let stashes = [];

const saveStash = () => {
  browser.windows.getCurrent({ populate: true }).then((windowInfo) => {
    const stash = {
      id: Date.now(),
      name: `Stash ${stashes.length + 1}`,
      tabs: windowInfo.tabs.map(tab => ({ url: tab.url, title: tab.title }))
    };
    stashes.push(stash);
    stashStates[stash.id] = true; // Set initial state to collapsed
    browser.storage.local.set({ stashes: stashes });
    updateStashList();
  });
};

const loadStash = (stashId, inNewWindow) => {
  const stash = stashes.find(s => s.id === stashId);
  if (stash) {
    if (inNewWindow) {
      browser.windows.create({ url: stash.tabs.map(tab => tab.url) });
    } else {
      browser.windows.getCurrent().then((currentWindow) => {
        stash.tabs.forEach(tab => {
          browser.tabs.create({ url: tab.url, windowId: currentWindow.id });
        });
      });
    }
  }
};
const deleteStash = (stashId) => {
  stashes = stashes.filter(s => s.id !== stashId);
  delete stashStates[stashId]; // Remove the state for the deleted stash
  browser.storage.local.set({ stashes: stashes });
  updateStashList();
};
const updateStashList = () => {
  const stashList = document.getElementById('stash-list');
  stashList.innerHTML = '';
  stashes.forEach(stash => {
    // Initialize state if it doesn't exist
    if (stashStates[stash.id] === undefined) {
      stashStates[stash.id] = true; // Start collapsed
    }

    const stashElement = document.createElement('div');
    stashElement.className = 'stash';
    stashElement.innerHTML = `
      <div class="stash-title">
        <span class="fold-icon mr-2 transform transition-transform duration-200">${stashStates[stash.id] ? '📦' : '📦'}</span>
        <span class="stash-name flex-grow truncate">${stash.name}</span>
        <span class="tab-count text-sm text-gray-600 dark:text-gray-400">(${stash.tabs.length})</span>
        <div class="stash-actions">
          <button class="stash-action-btn ml-2 restore-btn" title="Restore stash in current window">Restore</button>
          <button class="stash-action-btn new-window-btn" title="Open stash in new window">Open</button>
          <button class="stash-action-btn delete-btn" title="Delete stash">X</button>
        </div>
      </div>
      <div class="stash-tabs ${stashStates[stash.id] ? 'hidden' : ''}">
        ${stash.tabs.map(tab => `<div class="stash-tab">${tab.title}</div>`).join('')}
      </div>
    `;

    const stashTitle = stashElement.querySelector('.stash-title');
    const stashTabs = stashElement.querySelector('.stash-tabs');
    const foldIcon = stashElement.querySelector('.fold-icon');

    stashTitle.addEventListener('click', () => {
      stashStates[stash.id] = !stashStates[stash.id];
      stashTabs.classList.toggle('hidden');
      foldIcon.textContent = stashStates[stash.id] ? '📦' : '📦';
    });

    const restoreBtn = stashElement.querySelector('.restore-btn');
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadStash(stash.id, false);
    });

    const newWindowBtn = stashElement.querySelector('.new-window-btn');
    newWindowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadStash(stash.id, true);
    });

    const deleteBtn = stashElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteStash(stash.id);
    });

    stashList.appendChild(stashElement);
  });
};

document.addEventListener('DOMContentLoaded', initializeSidebar);
