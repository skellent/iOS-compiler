import { Browser } from "@capacitor/browser";
import { Api } from "./api.js";

export async function connectIntegration() {
  const { authorize_url } = await Api.authorizeGoogleDrive();
  await Browser.open({ url: authorize_url });
}
