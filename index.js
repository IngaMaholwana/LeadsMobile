const inputEl = document.getElementById("input-el");
const inputBtn = document.getElementById("input-btn");
const ulEl = document.getElementById("ul-el");
const deleteBtn = document.getElementById("delete-btn");
const emptyState = document.getElementById("empty-state");

const STORAGE_KEY = "leads-tracker-leads";
let leads = [];

// 1. Load leads from local storage on startup
try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        leads = JSON.parse(stored);
    }
} catch (e) {
    leads = [];
}

// 2. Save function to keep storage updated
function saveLeads() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

// 3. Render function
function render(leadsToRender) {
    // Handle empty state
    if (leadsToRender.length === 0) {
        ulEl.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }
    
    emptyState.classList.add("hidden");
    let listItems = "";
    
    // Build the HTML for each lead
    for (let i = 0; i < leadsToRender.length; i++) {
        const lead = leadsToRender[i];
        // Ensure the URL has http/https for the href
        const hrefUrl = lead.url.startsWith("http") ? lead.url : `https://${lead.url}`;
        
        listItems += `
            <li class="lead-item" style="animation-delay: ${i * 50}ms">
                <svg class="icon-link" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                
                <a target='_blank' href='${hrefUrl}'>
                    ${lead.url}
                </a>
                
                <button class="remove-btn" data-id="${lead.id}" aria-label="Remove lead">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
            </li>
        `;
    }
    ulEl.innerHTML = listItems;

    // Attach event listeners to the dynamically created delete buttons
    const removeBtns = document.querySelectorAll(".remove-btn");
    removeBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            const idToRemove = this.getAttribute("data-id");
            removeLead(idToRemove);
        });
    });
}

// 4. Individual Delete function
function removeLead(id) {
    leads = leads.filter(lead => lead.id !== id);
    saveLeads();
    render(leads);
}

// 5. Save Input Button
inputBtn.addEventListener("click", function() {
    const trimmedUrl = inputEl.value.trim();
    if (!trimmedUrl) return;
    
    // Add new lead to the BEGINNING of the array
    leads.unshift({
        id: crypto.randomUUID(),
        url: trimmedUrl,
        createdAt: Date.now()
    });
    
    saveLeads();
    inputEl.value = ""; // clear input
    render(leads);
});

// 6. Delete All Button
deleteBtn.addEventListener("dblclick", function() {
    leads = [];
    saveLeads();
    render(leads);
});

// Run render immediately on load
render(leads);