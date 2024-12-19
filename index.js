import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js"
import { getDatabase,
    ref,
    push,
    onValue
 } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js"


const firebaseConfig = {
    databaseURL: "https://leadsmobile-aa637-default-rtdb.europe-west1.firebasedatabase.app/"    
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const refenceleadsInDB = ref(database, "leads")

const inputEl = document.getElementById("input-el")
const inputBtn = document.getElementById("input-btn")
const ulEl = document.getElementById("ul-el")
const deleteBtn = document.getElementById("delete-btn")





function render(leads) {
    let listItems = ""
    for (let i = 0; i < leads.length; i++) {
        listItems += `
            <li>
                <a target='_blank' href='${leads[i]}'>
                    ${leads[i]}
                </a>
            </li>
        `
    }
    ulEl.innerHTML = listItems
}
onValue(refenceleadsInDB, function(snapshot) {
    console.log(snapshot)
    // if (snapshot.exists()) {
    //     let leads = Object.values(snapshot.val())
    //     render(leads)
    // } else {
    //     ulEl.innerHTML = "No leads yet"
    // }
})

deleteBtn.addEventListener("dblclick", function() {
    
  
    render(myLeads)
})

inputBtn.addEventListener("click", function() {
    push(refenceleadsInDB, inputEl.value)
    inputEl.value = ""
    
})