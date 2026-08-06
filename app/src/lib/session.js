import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "panicbutton.token";

let cachedUser = null;

export async function getToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value;
}

export async function setToken(token) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
  cachedUser = null;
}

export function getUser() {
  return cachedUser;
}

export function setUser(user) {
  cachedUser = user;
}
