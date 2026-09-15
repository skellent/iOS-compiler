import { Browser } from "@capacitor/browser";
import { Api } from "./api.js";

export async function connectIntegration(provider: "google" | "tiktok") {
  const { authorize_url } = await Api.authorizeIntegration(provider);
  await Browser.open({ url: authorize_url });
}
