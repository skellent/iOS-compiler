import { getToken, clearToken, getUser, setUser } from "./lib/session.js";
import { Api } from "./lib/api.js";

import { renderLogin } from "./views/login.js";
import { renderRegister } from "./views/register.js";
import { renderHome } from "./views/home.js";
import { renderContacts } from "./views/contacts.js";
import { renderProfile } from "./views/profile.js";

const viewEl = document.getElementById("view");
const bottomNav = document.getElementById("bottom-nav");
const appBarTitle = document.getElementById("app-bar-title");
const navTabs = [...document.querySelectorAll("#bottom-nav .nav-tab")];

const ROUTES = {
  login: { render: renderLogin, title: "Log In", public: true },
  register: { render: renderRegister, title: "Create Account", public: true },
  home: { render: renderHome, title: "Panic Switch", public: false },
  contacts: { render: renderContacts, title: "Emergency Contacts", public: false },
  profile: { render: renderProfile, title: "My Profile", public: false },
};

function navigate(route) {
  window.location.hash = `#/${route}`;
}

async function logout() {
  await clearToken();
  navigate("login");
}

async function refreshUser() {
  const user = await Api.getMe();
  setUser(user);
  return user;
}

function currentRouteName() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES[hash] ? hash : null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderCurrentRoute() {
  const loggedIn = Boolean(getUser());
  let name = currentRouteName();

  if (!name) {
    window.location.hash = `#/${loggedIn ? "home" : "login"}`;
    return;
  }

  const route = ROUTES[name];
  if (route.public && loggedIn) {
    window.location.hash = "#/home";
    return;
  }
  if (!route.public && !loggedIn) {
    window.location.hash = "#/login";
    return;
  }

  appBarTitle.textContent = route.title;
  bottomNav.classList.toggle("hidden", route.public);
  navTabs.forEach((tab) => tab.classList.toggle("nav-tab-active", tab.dataset.route === name));

  viewEl.classList.remove("view-visible");
  await wait(140);
  viewEl.innerHTML = "";

  await route.render(viewEl, { navigate, logout, getUser, refreshUser });

  requestAnimationFrame(() => viewEl.classList.add("view-visible"));
}

window.addEventListener("hashchange", renderCurrentRoute);
navTabs.forEach((tab) => tab.addEventListener("click", () => navigate(tab.dataset.route)));

async function boot() {
  const token = await getToken();
  if (token) {
    try {
      await refreshUser();
    } catch {
      await clearToken();
    }
  }
  await renderCurrentRoute();
}

boot();
