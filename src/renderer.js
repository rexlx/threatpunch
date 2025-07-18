import { Application } from "./app.js";
import { Contextualizer } from "./parser.js";

const apiUrl = "http://fairlady:8081/";
let application = new Application(apiUrl, "none");
let contextualizer = new Contextualizer();

const allViews = document.querySelectorAll('body > .section');
const matchBox = document.getElementById("matchBox");
const mainSection = document.getElementById("mainSection");
const profileView = document.getElementById("profileView");
const updateUserButton = document.getElementById("updateUserButton");
const serviceView = document.getElementById("servicesView");
const errorBox = document.getElementById("errors");
const editServerUrl = document.getElementById("editServerUrl");
const editUserEmail = document.getElementById("editUserEmail");
const editUserKey = document.getElementById("editUserKey");
const backButtonServices = document.getElementById("backButtonServices");
const backButtonProfile = document.getElementById("backButtonProfile");
const rectifyServicesButton = document.getElementById("rectifyServicesButton");
const notificationContainer = document.getElementById("notificationContainer");
const sidebarSearch = document.getElementById("sidebarSearch");
const sidebarRecentActivity = document.getElementById("sidebarRecentActivity");
const sidebarServices = document.getElementById("sidebarServices");
const sidebarProfile = document.getElementById("sidebarProfile");
const sidebarLinks = [sidebarSearch, sidebarRecentActivity, sidebarServices, sidebarProfile];

function showView(viewToShow) {
    allViews.forEach(view => {
        view.style.display = 'none';
    });
    document.getElementById('errata').style.display = 'block';
    if(viewToShow) {
        viewToShow.style.display = 'block';
    }
}

function setActiveSidebar(activeLink) {
    sidebarLinks.forEach(link => {
        if (link) {
            link.classList.remove('is-active');
        }
    });
    // The activeLink might be the span or icon, so we find the parent 'a' tag.
    if (activeLink) {
        activeLink.closest('a').classList.add('is-active');
    }
}

function renderSearchForm() {
    if(notificationContainer) {
        notificationContainer.innerHTML = '';
        notificationContainer.classList.remove('is-sticky-top');
    }
    if(matchBox) {
        matchBox.innerHTML = `
            <h1 class="title has-text-info">Search</h1>
            <form action="">
                <div class="field">
                    <div class="control">
                        <textarea class="textarea" placeholder="feed me..." id="userSearch"></textarea>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <button class="button is-info is-outlined" id="searchButton" type="submit">
                             <span class="icon-text"><span class="icon"><i class="material-icons">search</i></span><span>Search</span></span>
                        </button>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <div class="buttons are-small">
                            <button type="button" class="button is-black has-text-info-light" id="historyButton">
                                <span class="icon-text"><span class="icon"><i class="material-icons">history</i></span><span>history</span></span>
                            </button>
                            <button type="button" class="button is-black has-text-info-light" id="goToButton">
                                <span class="icon-text"><span class="icon"><i class="material-icons">double_arrow</i></span><span>go to</span></span>
                            </button>
                            <button type="button" class="button is-black has-text-info-light" id="uploadButton">
                                <span class="icon-text"><span class="icon"><i class="material-icons">upload_file</i></span><span>upload</span></span>
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }
}

function checkUser() {
    if (application.user && application.user.key && application.apiUrl) {
        showView(mainSection);
        renderSearchForm(); 
    } else {
        navigateToProfile();
    }
}

async function main() {
    showView(null); 
    await application.init(); 
    checkUser(); 
    attachEventListeners(); 
    requestAnimationFrame(updateUI); 
}

/**
 * Renders the filter input fields for the response cache view.
 * @returns {string} The HTML string for the filter form.
 */
function renderResponseFilters() {
    return `
        <h1 class="title has-text-info">Responses</h1>
        <div class="field is-grouped">
            <p class="control is-expanded">
                <input class="input" type="text" id="filterVendor" placeholder="Vendor">
            </p>
            <p class="control">
                <input class="input" type="number" id="filterStart" placeholder="Start (e.g., 0)">
            </p>
            <p class="control">
                <input class="input" type="number" id="filterLimit" placeholder="Limit (e.g., 100)">
            </p>
            <p class="control">
                <button class="button is-info" id="applyResponseFilters" type="button">
                    <span class="icon-text"><span class="icon"><i class="material-icons">filter_list</i></span><span>Apply</span></span>
                </button>
            </p>
        </div>
        <hr class="has-background-grey-dark">
        <div id="responseTableContainer">
            <p class="has-text-info">Fetching initial responses...</p>
        </div>
    `;
}

/**
 * Fetches response data with given options and renders it. Also attaches event listeners to links.
 * @param {object} options - The filtering and pagination options for the API call.
 */
async function handleResponseFetch(options = {}) {
    const container = document.getElementById('responseTableContainer');
    if (!container) return;

    container.innerHTML = '<p class="has-text-info">Fetching response cache...</p><progress class="progress is-small is-info" max="100"></progress>';
    const cacheHtml = await application.fetchResponseCache(options);
    container.innerHTML = cacheHtml;

    const links = container.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const href = link.getAttribute('href');
            const id = href.split('/').pop();
            if (id) {
                try {
                    await application.fetchDetails(id);
                    window.electronAPI.createDetailsWindow({
                        details: application.focus,
                        title: `Details for ${id}`
                    });
                } catch (error) {
                    application.errors.push(error.toString());
                }
            }
        });
    });
}


function attachEventListeners() {
    updateUserButton.addEventListener("click", async () => {
        await application.setUserData(editUserEmail.value, editUserKey.value, editServerUrl.value);
        await application.init();
        checkUser(); 
    });

    matchBox.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const targetId = button.id;

        if (targetId === 'searchButton') {
            event.preventDefault();
            // Clear previous results and errors before starting a new search
            application.results = []; 
            application.errors = [];
            
            const userSearch = document.getElementById('userSearch');
            if (!userSearch) return; 
            const searchText = userSearch.value;

            if(notificationContainer) notificationContainer.innerHTML = '';

            matchBox.innerHTML = "<p>Parsing text... searching...</p><progress class='progress is-primary'></progress>";

            const allMatches = Object.keys(contextualizer.expressions).map(key => {
                let matches = contextualizer.getMatches(searchText, contextualizer.expressions[key]);
                return { type: key, matches: [...new Set(matches)] };
            });

            for (let svr of application.user.services) {
                for (let matchPair of allMatches) {
                    if (svr.type.includes(matchPair.type)) {
                        const route = getRouteByType(svr.route_map, matchPair.type);
                        handleMatches(svr.kind, matchPair, route);
                    }
                }
            }
        }

        if (targetId === 'historyButton') {
            event.preventDefault();
            showView(mainSection);
            renderResultCards(application.resultHistory, true);
        }

        if (targetId === 'goToButton') {
             event.preventDefault();
            matchBox.innerHTML = `
                <div class="field">
                    <label class="label has-text-info">Enter ID</label>
                    <div class="control"><input class="input" type="text" placeholder="ID" id="goToValue"></div>
                    <div class="control"><button class="button is-primary mt-2" id="goButton">Go</button></div>
                </div>`;
        }

        if(targetId === 'goButton') {
            const id = document.getElementById("goToValue").value;
            try {
                await application.fetchDetails(id);
                window.electronAPI.createDetailsWindow({
                    details: application.focus,
                    title: `Details for ${id}`
                });
            } catch (error) {
                application.errors.push(error.toString());
            }
        }

        if (targetId === 'uploadButton') {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.addEventListener("change", async () => {
                const file = fileInput.files[0];
                if (!file) return;
                const newFile = new File([file], makeUnique(file.name), { type: file.type });
                await application.uploadFile(newFile);
            });
            fileInput.click();
        }

        if (targetId === 'applyResponseFilters') {
            const vendor = document.getElementById('filterVendor').value;
            const start = document.getElementById('filterStart').value;
            const limit = document.getElementById('filterLimit').value; 

            const options = {};
            if (vendor) options.vendor = vendor;
            if (start) options.start = parseInt(start, 10);
            if (limit) options.limit = parseInt(limit, 10);

            handleResponseFetch(options);
        }
    });


    backButtonServices.addEventListener('click', (e) => {
        e.preventDefault();
        showView(mainSection);
    });

    rectifyServicesButton.addEventListener('click', async (e) => {
        e.preventDefault();
        await application.rectifyServices();
        await navigateToServices(); // Re-render the view with updated service data
    });

    backButtonProfile.addEventListener('click', (e) => {
        e.preventDefault();
        if (application.user && application.user.key && application.apiUrl) {
            showView(mainSection);
        }
    });
    
    sidebarSearch.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveSidebar(e.target);
        showView(mainSection);
        renderSearchForm();
    });

    sidebarRecentActivity.addEventListener('click', async (e) => {
        e.preventDefault();
        setActiveSidebar(e.target);
        showView(mainSection);
        if (notificationContainer) notificationContainer.innerHTML = '';
    
        matchBox.innerHTML = renderResponseFilters();
    
        handleResponseFetch();
    });

    sidebarServices.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveSidebar(e.target);
        navigateToServices();
    });

    sidebarProfile.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveSidebar(e.target);
        navigateToProfile();
    });

    window.electronAPI.onNavigate(async (page) => {
        switch (page) {
            case 'services':
                setActiveSidebar(sidebarServices);
                navigateToServices();
                break;
            case 'profile':
                setActiveSidebar(sidebarProfile);
                navigateToProfile();
                break;
        }
    });
}

const navigateToServices = async () => {
    if (application.user && application.user.key && application.apiUrl) {
        await application.getServices();
        showView(serviceView);
        const cardList = document.getElementById('cardList');
        cardList.innerHTML = '';
        application.servers.forEach(data => {
            data.checked = application.user.services?.some(s => s.kind === data.kind) || false;
            const cardElement = createServiceCard(data);
            cardList.appendChild(cardElement);
        });
    }
};

const navigateToProfile = () => {
    editUserEmail.value = application.user.email || '';
    editUserKey.value = application.user.key || '';
    editServerUrl.value = application.apiUrl || '';
    showView(profileView);
};

function displayPastSearchesNotification(pastSearches, value) {
    if(!notificationContainer) return;
    notificationContainer.innerHTML = '';
    notificationContainer.classList.add('is-sticky-top');

    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const relevantPastSearches = pastSearches.filter(s => new Date(s.timestamp) < sixtySecondsAgo);

    const notification = document.createElement('div');
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete';
    deleteButton.onclick = () => {
        notificationContainer.innerHTML = '';
        notificationContainer.classList.remove('is-sticky-top');
    };
    notification.appendChild(deleteButton);

    const message = document.createElement('p');

    if (relevantPastSearches.length === 0) {
        notification.className = 'notification is-success is-light';
        message.innerHTML = `No relevant past searches found for "<strong>${escapeHtml(value)}</strong>".`;
    } else {
        const uniqueUsers = [...new Set(relevantPastSearches.map(s => s.from).filter(Boolean))];
        notification.className = 'notification is-info is-light';
        if (uniqueUsers.length === 0) {
            message.innerHTML = `Past searches for "<strong>${escapeHtml(value)}</strong>" were found, but with no user information.`;
        } else {
            message.innerHTML = `${escapeHtml(uniqueUsers.join(', '))}; past searches for "<strong>${escapeHtml(value)}</strong>".`;
        }
    }

    notification.appendChild(message);
    notificationContainer.appendChild(notification);
}

function renderResultCards(resultsArray, isHistoryView = false) {
    matchBox.innerHTML = ""; 
    if (resultsArray.length === 0) {
        matchBox.innerHTML = `<p class="has-text-info">${isHistoryView ? 'History is empty.' : 'No results found.'}</p>`;
        return;
    }

    resultsArray.sort((a, b) => (b.matched || 0) - (a.matched || 0));

    for (const result of resultsArray) {
        const article = document.createElement('article');
        article.className = 'message is-dark';

        const header = document.createElement('div');
        header.className = 'message-header';
        if (typeof result.background === 'string') {
            header.classList.add(escapeHtml(result.background));
        }

        const fromParagraph = document.createElement('p');
        fromParagraph.textContent = escapeHtml(result.from);
        header.appendChild(fromParagraph);

        const body = document.createElement('div');
        body.className = 'message-body has-background-dark-ter';

        const addMessageBodyParagraph = (text, value) => {
            const p = document.createElement('p');
            p.className = 'has-text-white';
            p.innerHTML = `${escapeHtml(text)}: <span class="has-text-white">${escapeHtml(String(value))}</span>`;
            body.appendChild(p);
        };

        addMessageBodyParagraph('Match', result.value);
        addMessageBodyParagraph('ID', result.id);
        addMessageBodyParagraph('Server ID', result.link);
        addMessageBodyParagraph('Attr Count', result.attr_count);
        addMessageBodyParagraph('Threat Level', result.threat_level_id);
        addMessageBodyParagraph('Info', result.info);

        const footer = document.createElement('footer');
        footer.className = 'card-footer';

        const historyButton = document.createElement('a');
        historyButton.href = '#';
        historyButton.className = 'card-footer-item has-background-black has-text-info';
        historyButton.innerHTML = `<span class="icon-text"><span class="icon"><i class="material-icons">history</i></span><span>Past Searches</span></span>`;
        historyButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const pastSearches = await application.fetchPastSearches(result.value);
            displayPastSearchesNotification(pastSearches, result.value);
        });

        const viewButton = document.createElement('a');
        viewButton.href = '#';
        viewButton.className = 'card-footer-item has-background-black has-text-info';
        viewButton.innerHTML = `<span class="icon-text"><span class="icon"><i class="material-icons">visibility</i></span><span>View Details</span></span>`;
        if (!result.link || result.link === "none") {
            viewButton.classList.add('is-disabled');
        }
        viewButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const thisLink = result.link;
            if (!thisLink || thisLink === "none") return;
            try {
                await application.fetchDetails(thisLink);
                window.electronAPI.createDetailsWindow({
                    details: application.focus,
                    title: `Details for ${thisLink}`
                });
            } catch (error) {
                application.errors.push(error.toString());
            }
        });

        footer.appendChild(historyButton);
        footer.appendChild(viewButton);

        article.appendChild(header);
        article.appendChild(body);
        article.appendChild(footer);
        matchBox.appendChild(article);
    }

    const footerContainer = document.createElement('footer');
    footerContainer.className = 'card-footer mt-4';

    const downloadButton = document.createElement('a');
    downloadButton.href = '#';
    downloadButton.className = 'card-footer-item has-background-primary has-text-black';
    downloadButton.innerHTML = `<span class="icon-text"><span class="icon"><i class="material-icons">download</i></span><span>Download CSV</span></span>`;
    downloadButton.addEventListener("click", (e) => {
        e.preventDefault();
        application.saveResultsToCSV(isHistoryView);
    });
    
    const clearButton = document.createElement('a');
    clearButton.href = '#';
    clearButton.className = 'card-footer-item has-background-primary has-text-black';
    const clearText = isHistoryView ? 'Clear History' : 'Clear Results';
    clearButton.innerHTML = `<span class="icon-text"><span class="icon"><i class="material-icons">delete_sweep</i></span><span>${clearText}</span></span>`;
    clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (isHistoryView) {
            application.resultHistory = [];
            application.setHistory(); 
        }
        application.results = [];
        previousResults = [];
        renderSearchForm();
    });

    footerContainer.appendChild(downloadButton);
    footerContainer.appendChild(clearButton);
    matchBox.appendChild(footerContainer);
}


let previousResults = [];
async function updateUI() {
    // Clear the box at the start of each render cycle
    errorBox.innerHTML = '';

    // Display any persistent errors. They are now only cleared when a new search starts.
    if (application.errors.length > 0) {
        const errors = [...new Set(application.errors)];
        errors.forEach(error => {
            errorBox.innerHTML += `<p class="has-text-warning">${escapeHtml(String(error))}</p>`;
        });
    }

    // Display the number of running jobs. This can appear alongside errors.
    if (application.resultWorkers.length > 0) {
        errorBox.innerHTML += `<p class="has-text-info">Jobs remaining: ${application.resultWorkers.length}</p>`;
    }

    // If, after checking for errors and jobs, the box is still empty, show the "nominal" status.
    if (errorBox.innerHTML === '') {
        errorBox.innerHTML = '<p class="has-text-success">System nominal</p>';
    }

    try {
        if (application.results.length > 0 && JSON.stringify(application.results) !== JSON.stringify(previousResults)) {
            previousResults = [...application.results];
            renderResultCards(application.results, false);
        }
    } catch (error) {
        console.error('Error in updateUI:', error);
        application.errors.push(`UI Update Failed: ${error}`);
    }
    requestAnimationFrame(updateUI);
}

function getRouteByType(routeMap, type) {
    if (!routeMap) return "";
    const route = routeMap.find(r => r.type === type);
    return route ? route.route : "";
}

async function handleMatches(kind, matchPair, route) {
    application.resultWorkers.push(1);
    for (let match of matchPair.matches) {
        if (isPrivateIP(match)) continue;
        try {
            let result = await application.fetchMatch(kind, match, matchPair.type, route);
            application.results.push(result);
        } catch (error) {
            application.errors.push(error.toString());
        }
    }
    await application.setHistory();
    application.resultWorkers.pop();
}

function createServiceCard(service) {
    const column = document.createElement('div');
    column.className = 'column is-one-third-desktop is-half-tablet';

    const card = document.createElement('div');
    card.className = 'card has-background-dark is-flex is-flex-direction-column';
    card.style.height = '100%';

    const header = document.createElement('header');
    header.className = 'card-header';

    const title = document.createElement('p');
    title.className = 'card-header-title has-text-white';
    title.textContent = escapeHtml(service.kind);
    header.appendChild(title);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'card-content has-background-black';
    contentDiv.style.flexGrow = '1'; 

    const content = document.createElement('div');
    content.className = 'content has-text-link-light';
    content.textContent = Array.isArray(service.type) ? service.type.map(escapeHtml).join(', ') : "Invalid Type";
    contentDiv.appendChild(content);

    const footer = document.createElement('footer');
    footer.className = 'card-footer';

    const addButton = document.createElement('a');
    addButton.href = '#';
    addButton.className = 'card-footer-item has-text-white';
    addButton.textContent = service.checked ? 'Remove' : 'Add';
    if(service.checked) {
        addButton.classList.add('has-background-warning');
    } else {
        addButton.classList.add('has-background-success');
    }
    
    footer.appendChild(addButton);
    
    card.appendChild(header);
    card.appendChild(contentDiv);
    card.appendChild(footer);

    addButton.addEventListener('click', (e) => {
        e.preventDefault();
        service.checked = !service.checked;
        if (service.checked) {
            application.addService(service);
            addButton.textContent = 'Remove';
            addButton.classList.remove('has-background-success');
            addButton.classList.add('has-background-warning');
        } else {
            application.removeService(service);
            addButton.textContent = 'Add';
            addButton.classList.remove('has-background-warning');
            addButton.classList.add('has-background-success');
        }
    });

    column.appendChild(card);
    return column;
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function makeUnique(filename) {
    const parts = filename.split(".");
    if (parts.length === 1) return `${parts[0]}_${Date.now()}`;
    const ext = parts.pop();
    const name = parts.join(".");
    return `${name}_${Date.now()}.${ext}`;
}

function isPrivateIP(ip) {
    if (typeof ip !== 'string') return false;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;
    const [p1, p2] = parts;
    if (p1 === 10) return true;
    if (p1 === 172 && (p2 >= 16 && p2 <= 31)) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 127) return true;
    if (p1 === 169 && p2 === 254) return true;
    return false;
}

main();
