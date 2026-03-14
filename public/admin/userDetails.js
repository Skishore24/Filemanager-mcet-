let usersData = {};
let currentPage = 1;
let rowsPerPage = 5;

let popupLogs = [];
let popupPage = 1;
let popupRows = 4;
let token = localStorage.getItem("token");
let blockedUsersList = [];
let confirmType = "";
let confirmMobile = "";

if(!token || token === "null"){
  window.location.href = "/admin/login.html";
}
async function loadBlockedUsers(){
  let res = await fetch("/api/users/blocked",{
  headers:{
    "Authorization":"Bearer " + token
  }
});
  let data = await res.json();
  blockedUsersList = data.map(u => u.mobile);
}

const avatarColors = [
  "linear-gradient(135deg,#6366f1,#7c3aed)",
  "linear-gradient(135deg,#22c55e,#16a34a)",
  "linear-gradient(135deg,#f59e0b,#f97316)",
  "linear-gradient(135deg,#06b6d4,#0ea5e9)",
  "linear-gradient(135deg,#ef4444,#dc2626)"
];

function getAvatarColor(name){
  let hash = 0;
  for(let i=0;i<name.length;i++){
    hash = name.charCodeAt(i) + ((hash<<5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

/* LOAD USERS */
async function loadUsers(){

  await loadBlockedUsers();   // add this line

  let res = await fetch("/api/logs?page=1&limit=500",{
    headers:{
      "Authorization":"Bearer " + token
    }
  });

  if (res.status === 401) {
    /* Session expired — redirect without blocking alert */
    localStorage.removeItem("token");
    window.location.href = "/admin/login.html";
    return;
  }
  let data = {};
    try{
      data = await res.json();
    } catch(e) {
      /* Silently handle parse error — usersData stays empty */
      console.error("Invalid API response while loading users");
    }
  let logs = data.logs || [];

  usersData = {};
  logs.forEach(log=>{
let key = log.mobile && log.mobile !== "Unknown"
          ? log.mobile
          : "Unknown";
if(!usersData[key])
usersData[key]=[];
usersData[key].push(log);
  });

  renderUsers();
}


/* RENDER TABLE */
function renderUsers(){

let table = document.getElementById("userTable");
let search = document.getElementById("searchUsers").value.toLowerCase();

let blocked = blockedUsersList || [];

let mobiles = Object.keys(usersData).filter(m=>{
  let name = usersData[m][0].name || "";
  return (
    (name.toLowerCase().includes(search) || m.includes(search)) &&
    !blocked.includes(m)
  );
});


let start = (currentPage-1)*rowsPerPage;
let pageUsers = mobiles.slice(start,start+rowsPerPage);

table.innerHTML="";

pageUsers.forEach(mobile=>{
let logs = usersData[mobile];
let name = logs[0].name || "Unknown";
let visits = logs.length;
let state = logs[0].state || "";
let country = logs[0].country || "";
let location = (state || country) ? state + ", " + country : "-";

let status = getUserStatus(logs);

table.innerHTML += `
<tr>
<td data-label="Select"><input type="checkbox" class="userCheck" onchange="updateBulkActions()"></td>
<td data-label="Name">
  <div class="user-name">
    <div class="user-avatar"
         style="background:${getAvatarColor(name)}">
         ${escapeHTML(name).charAt(0).toUpperCase()}
    </div>
    <span>${escapeHTML(name)}</span>
  </div>
</td>

<td data-label="Mobile">${escapeHTML(mobile)}</td>

<td data-label="Status">
  <span class="status ${status}">
    <span class="status-dot"></span>
    ${status === "online" ? "Online" : "Offline"}
  </span>
</td>
<td data-label="Location">${escapeHTML(location)}</td>

<td data-label="Visits">${visits}</td>

<td data-label="Action">
  <button class="view-btn" onclick="openUser('${escapeHTML(mobile)}')">View</button>
</td>
</tr>`;

});

let totalPages = Math.ceil(mobiles.length/rowsPerPage) || 1;
if(currentPage > totalPages) currentPage = totalPages;

document.getElementById("pageInfo").innerText =
`Page ${currentPage} of ${totalPages}`;

}
function updateBulkActions(){
  let checked = document.querySelectorAll(".userCheck:checked").length;
  let panel = document.getElementById("bulkActions");

  if(checked > 0){
    panel.style.display = "flex";
  }else{
    panel.style.display = "none";
  }
}
function toggleSelectAll(){

  let master = document.getElementById("selectAllUsers");
  let checks = document.querySelectorAll(".userCheck");

  checks.forEach(cb => cb.checked = master.checked);

  updateBulkActions();
}

/* POPUP */
function openUser(mobile){

  // FIRST assign logs
  popupLogs = usersData[mobile];
  popupPage = 1;

  // Avatar initials
  let name = popupLogs[0].name || "U";
let initials = name ? name.charAt(0).toUpperCase() : "U";

  document.getElementById("avatarCircle").innerText = initials;

  // Status
  let status = getUserStatus(popupLogs);
  document.getElementById("uStatus").innerHTML =
    `<span class="status ${status}">
       <span class="status-dot"></span>
       ${status === "online" ? "Online" : "Offline"}
     </span>`;

  // User details
  document.getElementById("uName").innerText = name;
  document.getElementById("uMobile").innerText = mobile;
  document.getElementById("uVisits").innerText = popupLogs.length;
let latestVisit = [...popupLogs]
  .sort((a,b)=> new Date(b.viewed_at)-new Date(a.viewed_at))[0];

document.getElementById("uLastVisit").innerText =
  formatDateTime(latestVisit.viewed_at);
  // Location (if available)
  let state = popupLogs[0].state || "-";
  let country = popupLogs[0].country || "-";
  document.getElementById("uLocation").innerText = state + ", " + country;

  renderPopupFiles(popupLogs);

  document.getElementById("userModal").style.display = "flex";
}


function renderPopupFiles(userLogs){

  let table = document.getElementById("uFileTable");
  let pagination = document.getElementById("popupPagination");

  table.innerHTML = "";
  pagination.innerHTML = "";

  let start = (popupPage-1)*popupRows;
  let end = start + popupRows;

  let pageLogs = userLogs.slice(start,end);

pageLogs.forEach(log=>{
table.innerHTML += `
<tr>
  <td data-label="File">${escapeHTML(log.file_name)}</td>
  <td data-label="Viewed At">${formatDateTime(log.viewed_at)}</td>

</tr>`;

});



let totalPages = Math.max(1, Math.ceil(userLogs.length / popupRows));

  pagination.innerHTML = `
    <button onclick="prevPopup()">Prev</button>
    Page ${popupPage} of ${totalPages}
    <button onclick="nextPopup(${totalPages})">Next</button>
  `;
}

function nextPopup(totalPages){
  if(popupPage < totalPages){
    popupPage++;
    renderPopupFiles(popupLogs);
  }
}

function prevPopup(){
  if(popupPage>1){
    popupPage--;
    renderPopupFiles(popupLogs);
  }
}

function closeUserModal(){
document.getElementById("userModal").style.display="none";
}
function nextPage(){
  let totalPages = Math.ceil(Object.keys(usersData).length / rowsPerPage);
  if(currentPage < totalPages){
    currentPage++;
    renderUsers();
  }
}
async function blockSelected() {

  const mobiles = getSelectedMobiles();

  if (mobiles.length === 0) {
    openSuccessPopup("⚠️ Please select at least one user first.");
    return;
  }

  for (const mobile of mobiles) {
    await fetch("/api/users/block", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ mobile })
    });
  }

  openSuccessPopup("✅ Selected users have been blocked.");
  await loadBlockedUsers();
  loadUsers();

}
async function deleteSelected() {

  const mobiles = getSelectedMobiles();

  if (mobiles.length === 0) {
    openSuccessPopup("⚠️ Please select at least one user first.");
    return;
  }

  confirmType   = "deleteSelected";
  confirmMobile = mobiles;

  document.getElementById("confirmTitle").innerText   = "Delete Users";
  document.getElementById("confirmMessage").innerText = "Are you sure you want to delete all logs for selected users?";

  document.getElementById("confirmModal").style.display = "flex";

}

function prevPage(){ if(currentPage>1){ currentPage--; renderUsers(); } }
function blockUser(){
  confirmType = "block";
  confirmMobile = document.getElementById("uMobile").innerText;

  document.getElementById("confirmTitle").innerText = "Block User";
  document.getElementById("confirmMessage").innerText =
    "Are you sure you want to block this user?";

  document.getElementById("confirmModal").style.display = "flex";
}

function deleteUser(){
  confirmType = "delete";
  confirmMobile = document.getElementById("uMobile").innerText;

  document.getElementById("confirmTitle").innerText = "Delete User";
  document.getElementById("confirmMessage").innerText =
    "This will permanently delete all logs of this user.";

  document.getElementById("confirmModal").style.display = "flex";
}


function getSelectedMobiles(){
  let checks = document.querySelectorAll(".userCheck:checked");
  let mobiles = [];

  checks.forEach(cb => {
    let row = cb.closest("tr");
    let mobile = row.children[2].innerText.trim();
    mobiles.push(mobile);
  });

  return mobiles;
}

async function confirmAction(){

  // BLOCK SINGLE USER
  if(confirmType === "block"){
    await fetch("/api/users/block", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":"Bearer " + token
      },
      body: JSON.stringify({ mobile: confirmMobile })
    });
  }

  // DELETE SINGLE USER
  if(confirmType === "delete"){
    await fetch("/api/users/delete-user-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":"Bearer " + token
      },
      body: JSON.stringify({ mobile: confirmMobile })
    });
  }

  // DELETE MULTIPLE USERS
  if(confirmType === "deleteSelected"){
    for(let mobile of confirmMobile){
      await fetch("/api/users/delete-user-logs", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer " + token
        },
        body: JSON.stringify({ mobile })
      });
    }
  }
  await loadBlockedUsers();
  closeConfirm();
  closeUserModal();
  loadUsers();
}

function closeConfirm(){
  document.getElementById("confirmModal").style.display = "none";
}

/* BLOCKED MODAL */
async function openBlockedModal(){
  try{
    let res = await fetch("/api/users/blocked",{
      headers:{
        "Authorization":"Bearer " + token
      }
    });
    let blocked = await res.json();

    let table = document.getElementById("blockedTable");
    table.innerHTML = "";

    if(!blocked || blocked.length === 0){
      table.innerHTML = "<tr><td colspan='2'>No blocked users</td></tr>";
    }else{
      blocked.forEach(user=>{
        table.innerHTML += `
          <tr>
            <td>${user.mobile}</td>
            <td>
              <button class="view-btn" onclick="unblockUser('${user.mobile}')">
                Unblock
              </button>
            </td>
          </tr>`;
      });
    }

    document.getElementById("blockedModal").style.display="flex";

  } catch (err) {
    console.error("Blocked modal error:", err);
    openSuccessPopup("⚠️ Could not load blocked users. Please try again.");
  }
}


/* ============================================================
   openSuccessPopup(message)
   Shows a temporary success/info popup modal.
   Works with the #successModal in userDetails.html.
   Falls back to console if element is missing.
   ============================================================ */
function openSuccessPopup(message) {

  const el = document.getElementById("successModal");

  if (!el) {
    console.info("[Popup]", message);
    return;
  }

  const msgEl = document.getElementById("successMessage");
  if (msgEl) msgEl.innerText = message;

  el.style.display = "flex";

}

function closeSuccessPopup() {
  const el = document.getElementById("successModal");
  if (el) el.style.display = "none";
}

async function unblockUser(mobile){

  await fetch("/api/users/unblock", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer " + token
    },
    body: JSON.stringify({ mobile })
  });

  openBlockedModal();
  loadUsers();
}

window.onclick = function(e){
  let userModal = document.getElementById("userModal");
  let blockedModal = document.getElementById("blockedModal");
  let confirmModal = document.getElementById("confirmModal");

  if(e.target === userModal) closeUserModal();
  if(e.target === blockedModal) closeBlockedModal();
  if(e.target === confirmModal) closeConfirm();
};



function closeBlockedModal(){
document.getElementById("blockedModal").style.display="none";
}

function toggleMenu(){
  document.querySelector(".sidebar").classList.toggle("active");
  document.querySelector(".overlay").classList.toggle("active");
}

function getUserStatus(logs){

  if(!logs || logs.length === 0)
    return "offline";

  let latestActive = logs
    .map(l => l.last_active || l.viewed_at)
    .sort((a,b)=> new Date(b) - new Date(a))[0];

  if(!latestActive)
    return "offline";

  let lastTime = new Date(latestActive).getTime();
  let now = Date.now();

  return (now-lastTime <= 30000) ? "online" : "offline";
}

document.addEventListener("DOMContentLoaded", loadUsers);
setInterval(loadUsers, 60000);

setInterval(() => {

  let mobile = sessionStorage.getItem("verifiedMobile");
  if(!mobile) return;

  fetch("/api/users/heartbeat", {
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "Authorization":"Bearer " + token
  },
  body: JSON.stringify({ mobile })
});

}, 5000);

function logoutUser(){
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  window.location.href = "/admin/login.html";
}
function formatDateTime(dateString){
  if(!dateString) return "-";

  const date = new Date(dateString);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/* ===== Load Logged User Info ===== */
let currentUser = JSON.parse(localStorage.getItem("currentUser"));

if(currentUser){

  let nameEl = document.getElementById("userName");
  let emailEl = document.getElementById("userEmail");

  if(nameEl)
    nameEl.innerText = currentUser.name || "Admin";

  if(emailEl)
    emailEl.innerText = currentUser.email || "";
}
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}
