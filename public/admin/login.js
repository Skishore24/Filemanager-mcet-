console.log("login.js loaded");

document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("loginForm");
  const toggle = document.getElementById("togglePassword");

  /* FORM SUBMIT */
  if(form){
    form.addEventListener("submit", function(e){
      e.preventDefault(); // prevent page reload
      login();
    });
  }

  /* PASSWORD TOGGLE */
  if(toggle){
    toggle.addEventListener("click", function(){

      const passwordInput = document.getElementById("password");

      if(passwordInput.type === "password"){
        passwordInput.type = "text";
        this.classList.remove("fa-eye");
        this.classList.add("fa-eye-slash");
      }else{
        passwordInput.type = "password";
        this.classList.remove("fa-eye-slash");
        this.classList.add("fa-eye");
      }

    });
  }

});


/* LOGIN FUNCTION */
async function login(){

  console.log("LOGIN BUTTON CLICKED");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const messageBox = document.getElementById("loginMessage");

  messageBox.className = "login-message show";
  messageBox.innerText = "";

  if(!email || !password){
    messageBox.innerText = "Enter username and password";
    messageBox.classList.add("error");
    return;
  }

  try{

    const res = await fetch("/api/auth/login",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify({ email, password })
    });

    console.log("STATUS:", res.status);

    const data = await res.json();

    console.log("LOGIN RESPONSE:", data);

    if(data.token){

      // save token
      localStorage.setItem("token", data.token);

      // save user info
      if(data.user){
        localStorage.setItem("currentUser", JSON.stringify(data.user));
      }

      console.log("Login success → redirecting");

      window.location.href = "/admin/dashboard.html";

    }else{

      messageBox.classList.add("error");
      messageBox.innerText = data.message || "Login failed";

    }

  }catch(err){

    console.error("LOGIN ERROR:", err);

    messageBox.classList.add("error");
    messageBox.innerText = "Server error";

  }

}
