import { Application } from "./app.js";
import { Contextualizer } from "./parser.js";

const apiUrl = "http://fairlady:8081/"; // This is just a default
let application = new Application(apiUrl, "none");
let contextualizer = new Contextualizer();

// --- DOM Elements ---
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
// Sidebar links
const sidebarSearch = document.getElementById("sidebarSearch");
const sidebarServices = document.getElementById("sidebarServices");
const sidebarProfile = document.getElementById("sidebarProfile");


// --- UI State & Initialization ---

/**
 * Hides all view sections and then shows the one specified by the element.
 * @param {HTMLElement} viewToShow The section element to make visible.
 */
function showView(viewToShow) {
    allViews.forEach(view => {
        view.style.display = 'none';
    });
    // The errata bar should always be visible
    document.getElementById('errata').style.display = 'block';
    if(viewToShow) {
        viewToShow.style.display = 'block';
    }
}

/**
 * Renders the initial search form into the matchBox container.
 */
function renderSearchForm() {
    matchBox.innerHTML = `
        <h1 class="title has-text-info">Search</h1>
        <form action="">
            <div class="field">
                <div class="control">
                    <textarea class="textarea" placeholder="Feed me data..." id="userSearch"></textarea>
                </div>
            </div>
            <div class="field">
                <div class="control">
                    <button class="button is-info is-outlined" id="searchButton" type="submit">Search</button>
                </div>
            </div>
            <div class="field">
                <div class="control">
                    <div class="buttons are-small">
                        <button class="button is-black has-text-info-light" id="historyButton">History</button>
                        <button class="button is-black has-text-info-light" id="goToButton">Go To</button>
                        <button class="button is-black has-text-info-light" id="uploadButton">Upload</button>
                    </div>
                </div>
            </div>
        </form>
    `;
}


/**
 * Checks if essential user data is present.
 * If so, shows the main app. If not, shows the profile/settings screen.
 */
function checkUser() {
    if (application.user && application.user.key && application.apiUrl) {
        showView(mainSection);
        renderSearchForm(); // Show the search form by default
    } else {
        editUserEmail.value = application.user.email || '';
        editUserKey.value = application.user.key || '';
        editServerUrl.value = application.apiUrl || '';
        showView(profileView);
    }
}

// Main application entry point
async function main() {
    showView(null); // Hide all views initially
    await application.init(); // Asynchronously load data from the store
    checkUser(); // Update the UI based on loaded data
    attachEventListeners(); // Attach all event listeners
    requestAnimationFrame(updateUI); // Start the UI update loop
}

function attachEventListeners() {
    // The "Update" button on the profile screen is now the main way to save settings.
    updateUserButton.addEventListener("click", async () => {
        await application.setUserData(editUserEmail.value, editUserKey.value, editServerUrl.value);
        await application.init();
        checkUser(); // Re-check the user data to see if we can move to the main screen.
    });

    // Use event delegation for the matchBox since its content is dynamic
    matchBox.addEventListener('click', async (event) => {
        const targetId = event.target.id;

        if (targetId === 'searchButton') {
            event.preventDefault();
            application.results = []; // Clear previous results
            
            const userSearch = document.getElementById('userSearch');
            if (!userSearch) return; 
            const searchText = userSearch.value;

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
                const dataUrl = `data:text/html;charset=utf-8,
                    <body style="background-color:#111; color: #eee; font-family: monospace; white-space: pre; padding: 1em;">
                    ${escapeHtml(JSON.stringify(application.focus, null, 2))}
                    </body>`;
                window.electronAPI.createWindow({ url: dataUrl, title: `Details for ${id}` });
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
    });


    backButtonServices.addEventListener('click', (e) => {
        e.preventDefault();
        showView(mainSection);
    });
    backButtonProfile.addEventListener('click', (e) => {
        e.preventDefault();
        if (application.user && application.user.key && application.apiUrl) {
            showView(mainSection);
        }
    });
    
    // --- Sidebar Navigation ---
    sidebarSearch.addEventListener('click', (e) => {
        e.preventDefault();
        showView(mainSection);
        renderSearchForm();
    });

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

    sidebarServices.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToServices();
    });

    sidebarProfile.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToProfile();
    });


    // --- Listen for Top Menu Bar Navigation ---
    window.electronAPI.onNavigate(async (page) => {
        switch (page) {
            case 'services':
                navigateToServices();
                break;
            case 'profile':
                navigateToProfile();
                break;
        }
    });
}

/**
 * --- THIS IS THE NEW HELPER FUNCTION ---
 * Renders an array of results as cards in the matchBox.
 * @param {Array} resultsArray The array of results to render (e.g., application.results or application.resultHistory)
 * @param {boolean} isHistoryView Differentiates between a history view and a results view for button text/actions.
 */
function renderResultCards(resultsArray, isHistoryView = false) {
    matchBox.innerHTML = ""; // Clear previous content
    if (resultsArray.length === 0) {
        matchBox.innerHTML = `<p class="has-text-info">${isHistoryView ? 'History is empty.' : 'No results found.'}</p>`;
        return;
    }

    resultsArray.sort((a, b) => (b.matched || 0) - (a.matched || 0));

    for (const result of resultsArray) {
        const uniq = `details-${result.link}`;
        const article = document.createElement('article');
        article.className = 'message is-dark';

        const header = document.createElement('div');
        header.className = 'message-header';
        if (typeof result.background === 'string') {
            header.classList.add(escapeHtml(result.background));
        }

        const fromParagraph = document.createElement('p');
        fromParagraph.textContent = escapeHtml(result.from);

        const viewButton = document.createElement('button');
        viewButton.className = 'button is-link is-outlined view-button';
        viewButton.id = uniq;
        viewButton.textContent = 'view';
        viewButton.disabled = !result.link || result.link === "none";

        header.appendChild(fromParagraph);
        header.appendChild(viewButton);

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

        article.appendChild(header);
        article.appendChild(body);
        matchBox.appendChild(article);

        viewButton.addEventListener('click', async (e) => {
            const thisLink = e.target.id.replace("details-", "");
            try {
                await application.fetchDetails(thisLink);
                const dataUrl = `data:text/html;charset=utf-8,
                    <body style="background-color:#111; color: #eee; font-family: monospace; white-space: pre; padding: 1em;">
                    ${escapeHtml(JSON.stringify(application.focus, null, 2))}
                    </body>`;
                window.electronAPI.createWindow({ url: dataUrl, title: `Details for ${thisLink}` });
            } catch (error) {
                application.errors.push(error.toString());
            }
        });
    }

    // --- Action Buttons ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'buttons mt-4';

    // Download Button
    const downloadButton = document.createElement('button');
    downloadButton.className = 'button is-primary';
    downloadButton.textContent = 'Download CSV';
    downloadButton.addEventListener("click", () => application.saveResultsToCSV(isHistoryView));
    
    // Clear Button
    const clearButton = document.createElement('button');
    clearButton.className = 'button is-warning is-outlined';
    clearButton.textContent = isHistoryView ? 'Clear History' : 'Clear Results';
    clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (isHistoryView) {
            application.resultHistory = [];
            application.setHistory(); // Persist the empty history
        }
        application.results = [];
        previousResults = [];
        renderSearchForm();
    });

    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(clearButton);
    matchBox.appendChild(buttonContainer);
}


let previousResults = [];
async function updateUI() {
    // Error display
    if (application.errors.length > 0) {
        errorBox.innerHTML = '';
        const errors = [...new Set(application.errors)];
        errors.forEach(error => {
            errorBox.innerHTML += `<p class="has-text-warning">${escapeHtml(String(error))}</p>`;
        });
        application.errors = [];
    } else if (application.resultWorkers.length > 0) {
        errorBox.innerHTML = `<p class="has-text-info">Jobs remaining: ${application.resultWorkers.length}</p>`;
    } else {
        errorBox.innerHTML = '<p class="has-text-success">System nominal</p>';
    }


    // Results display
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


// --- Utility Functions ---
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

// Start the application
main();
