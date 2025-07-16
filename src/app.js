export class Application {
    constructor(apiUrl, apiKey) {
        this.user = {};
        this.resultWorkers = [];
        this.results = [];
        this.errors = [];
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.servers = [];
        this.resultHistory = [];
        this.focus = { "message": "this data wasn't ready or something truly unexpected happened" };
        this.initialized = false;
    }

    async init() {
        const storedApiUrl = await window.electronAPI.store.get("apiUrl");
        if (storedApiUrl) {
            this.apiUrl = storedApiUrl;
        } else {
            this.apiUrl = "http://fairlady:8081/";
        }

        const storedUser = await window.electronAPI.store.get("user");
        if (storedUser) {
            this.user = storedUser;
        }

        await this.fetchHistory();
        if (this.user.email && this.user.key) {
            await this.fetchUser();
            await this.getServices();
        }
        this.initialized = true;
    }

    async setUserData(email, key, url) {
        this.user.email = email;
        this.user.key = key;
        this.apiUrl = url;
        await window.electronAPI.store.set("user", this.user);
        await window.electronAPI.store.set("apiUrl", url);
        console.log("User data saved", url);
    }
    async fetchResponseCache(options = {}) {
        if (!this.apiUrl || !this.user.key) {
            return "<p>User or API URL not configured.</p>";
        }

        // Base URL for the endpoint
        const baseUrl = this.apiUrl + `/getresponses`;

        // Use URLSearchParams to safely build the query string
        const params = new URLSearchParams();
        if (options.vendor) {
            params.append('vendor', options.vendor);
        }
        if (options.start !== undefined) {
            params.append('start', options.start);
        }
        if (options.limit !== undefined) {
            params.append('limit', options.limit);
        }

        // Construct the final URL
        const finalURL = `${baseUrl}?${params.toString()}`;
        console.log(`Fetching from: ${finalURL}`); // For debugging

        try {
            const response = await fetch(finalURL, {
                method: 'GET',
                headers: {
                    'Authorization': `${this.user.email}:${this.user.key}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            this.errors.push(`Error fetching response cache: ${error.message}`);
            return `<p class="has-text-danger">Error fetching response cache: ${error.message}</p>`;
        }
    }

    async fetchPastSearches(value) {
        if (!this.apiUrl || !this.user.key) {
            return [];
        }
        let valueRequest = {
            "value": value || "",
        }
        const thisURL = this.apiUrl + `previous-responses`;
        // console.log("Fetching past searches from:", thisURL, "with value:", valueRequest.value);
        try {
            const response = await fetch(thisURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${this.user.email}:${this.user.key}`
                },
                body: JSON.stringify(valueRequest)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            this.errors.push(`Error fetching past searches: ${error.message}`);
            return [];
        }
    }

    addService(service) {
        if (!this.user.services) {
            this.user.services = [];
        }
        this.user.services.push(service);
        this.updateUser(this.user);
    }

    removeService(service) {
        if (this.user.services) {
            this.user.services = this.user.services.filter(s => s.kind !== service.kind);
            this.updateUser(this.user);
        }
    }

    async saveResultsToCSV(includeHistory) {
        const rightFreakinNow = new Date();
        const filename = `results-${rightFreakinNow.getFullYear()}-${rightFreakinNow.getMonth() + 1}-${rightFreakinNow.getDate()}.csv`;
        let csvContent = "server-id,local-id,value,from,matched,info\n";
        let data = this.results;
        if (includeHistory) {
            data = [...data, ...this.resultHistory];
        }
        data.forEach((result) => {
            if (result.info && result.info.includes(",")) {
                result.info = result.info.replaceAll(",", " - ");
            }
            let row = `${result.link || ''},${result.id || ''},${result.value || ''},${result.from || ''},${result.matched || ''},${result.info || ''}\n`;
            csvContent += row;
        });

        const result = await window.electronAPI.saveFile({ filename: filename, content: csvContent });
        if (result.success) {
            this.errors.push(`File saved to ${result.path}`);
        } else {
            this.errors.push('File save was cancelled.');
        }
    }

    async fetchHistory() {
        try {
            const history = await window.electronAPI.store.get("history");
            if (history && Array.isArray(history)) {
                this.resultHistory = history;
            }
        } catch (err) {
            this.errors.push("Error fetching history: " + err);
        }
    }

    async setHistory() {
        if (this.resultHistory.length > 50) {
            this.resultHistory.splice(0, this.resultHistory.length - 50);
        }
        await window.electronAPI.store.set("history", this.resultHistory);
    }

    async sendLog(message) {
        if (!this.apiUrl) {
            this.errors.push("API URL is not set. Cannot send log.");
            return;
        }
        if (!this.user || !this.user.email) {
            this.errors.push("User email is not set. Cannot send log.");
            return;
        }

        const thisURL = this.apiUrl + `logger`;
        const logData = {
            username: this.user.email,
            message: message
        };

        try {
            if (logData.message === "") {
                this.errors.push("Log message is empty. Cannot send log.");
                return;
            }
            const response = await fetch(thisURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${this.user.email}:${this.user.key}`
                },
                body: JSON.stringify(logData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            this.errors.push(`Error sending log: ${error.message}`);
        }
    }
    async uploadFile(file) {
        const thisURL = this.apiUrl + `upload`;
        const chunkSize = 1024 * 1024;
        let currentChunk = 0;

        const uploadChunk = async () => {
            const start = currentChunk * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            const progress = Math.ceil((end / file.size) * 100);
            let progressBar = `<progress class="progress" value="${progress}" max="100"></progress>`;
            try {
                const response = await fetch(thisURL, {
                    method: 'POST',
                    headers: {
                        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
                        'X-filename': encodeURIComponent(file.name),
                        'X-last-chunk': currentChunk === Math.ceil(file.size / chunkSize) - 1,
                        'Authorization': `${this.user.email}:${this.user.key}`
                    },
                    body: chunk
                });

                if (!response.ok) {
                    console.error('Error uploading chunk:', response.status);
                    this.sendLog(`Error uploading chunk: ${response.status}`);
                } else {
                    currentChunk++;
                    if (currentChunk < Math.ceil(file.size / chunkSize)) {
                        this.errors = [];
                        this.errors.push(progressBar);
                        uploadChunk();
                    } else {
                        let progressBar = `<p class="has-text-info">uploaded ${file.name}</p>`;
                        this.errors = [];
                        this.errors.push(progressBar);
                        console.log('File uploaded successfully!');
                        const data = await response.json();
                        if (data && data.id) {
                            let newResult = {
                                "background": "has-background-success",
                                "from": "uploader service",
                                "id": data.id,
                                "value": file.name,
                                "link": "none",
                                "attr_count": 0,
                                "threat_level_id": 0,
                                "info": `${data.status} uploaded! the end service may still be processing the file.`
                            }
                            this.results.push(newResult);
                        }
                    }
                }

            } catch (error) {
                console.error('Error uploading chunk:', error);
                this.sendLog(`Error uploading chunk: ${error.message}`);
            }
        };

        uploadChunk();
    }
    async fetchUser() {
        if (!this.user.email || !this.user.key) return;
        let thisURL = this.apiUrl + `user`
        let response = await fetch(thisURL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${this.user.email}:${this.user.key}`
            }
        });
        let data = await response.json();
        this.user = data;
    }
    async fetchDetails(id) {
        if (!id) {
            this.errors.push("No ID provided for fetching details.");
            return;
        }
        let thisURL = this.apiUrl + `events/${id}`
        let response = await fetch(thisURL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${this.user.email}:${this.user.key}`
            }
        });
        if (!response.ok) {
            this.errors.push(`Error fetching details for ID ${id}: ${response.statusText}`);
            return;
        }
        let data = await response.json();
        this.focus = data;
    }
    async updateUser(user) {
        let thisURL = this.apiUrl + `updateuser`
        let response = await fetch(thisURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${this.user.email}:${this.user.key}`
            },
            body: JSON.stringify(user)
        });
        let data = await response.json();
        this.user = data;
    }
    async fetchMatch(to, match, type, route) {
        let thisURL = this.apiUrl + `pipe`
        const proxyRequest = {
            "username": this.user.email,
            "to": to,
            "value": match,
            "type": type,
            "route": route
        }
        let response = await fetch(thisURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${this.user.email}:${this.user.key}`
            },
            body: JSON.stringify(proxyRequest)
        });
        let data = await response.json();
        if (this.resultHistory.length > 50) {
            let num2Rm = this.resultHistory.length - 50;
            this.resultHistory.splice(0, num2Rm);
        }
        this.resultHistory.push(data);
        return data;
    }

    async rectifyServices() {
        if (!this.apiUrl || !this.user.key) {
            this.errors.push("User or API URL not configured.");
            return;
        }
        const thisURL = this.apiUrl + `rectify`;
        try {
            const response = await fetch(thisURL, {
                method: 'GET',
                headers: {
                    'Authorization': `${this.user.email}:${this.user.key}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.errors = [data.message || "Services rectified successfully."];
            await this.getServices(); // Refresh the list of services

        } catch (error) {
            this.errors.push(`Error rectifying services: ${error.message}`);
        }
    }

    async getServices() {
        if (!this.user.email || !this.user.key) return;
        let thisURL = this.apiUrl + `getservices`
        try {
            let response = await fetch(thisURL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${this.user.email}:${this.user.key}`
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            let data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error("Error fetching services: " + JSON.stringify(data));
            }

            this.servers = data.map(sanitizeService);
            this.errors = [];
        } catch (err) {
            this.errors.push("Error fetching services: " + err);
        }
    }
}

function sanitizeService(service) {
    if (!service || typeof service !== 'object') {
        return {
            upload_service: false, expires: 0, secret: "", selected: false, insecure: false, name: "", url: "",
            rate_limited: false, max_requests: 0, refill_rate: 0, auth_type: "", key: "", kind: "", type: [],
            route_map: null, description: ""
        };
    }
    return {
        upload_service: Boolean(service.upload_service),
        expires: Number.isInteger(service.expires) ? service.expires : 0,
        secret: String(service.secret || ''),
        selected: Boolean(service.selected),
        insecure: Boolean(service.insecure),
        name: String(service.name || '').replace(/[<>&"'`;]/g, ''),
        url: String(service.url || '').startsWith('http') ? service.url : '',
        rate_limited: Boolean(service.rate_limited),
        max_requests: Number.isInteger(service.max_requests) ? service.max_requests : 0,
        refill_rate: Number.isInteger(service.refill_rate) ? service.refill_rate : 0,
        auth_type: String(service.auth_type || ''),
        key: String(service.key || ''),
        kind: String(service.kind || ''),
        type: Array.isArray(service.type) ? service.type.map(String) : [],
        route_map: service.route_map,
        description: String(service.description || '').replace(/[<>&"'`;]/g, '')
    }
}
