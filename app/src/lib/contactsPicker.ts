import { Contacts } from "@capacitor-community/contacts";

export async function pickDeviceContact() {
  const { contact } = await Contacts.pickContact({
    projection: { name: true, phones: true, emails: true },
  });

  return {
    name: contact.name?.display ?? "",
    phone: contact.phones?.[0]?.number ?? "",
    email: contact.emails?.[0]?.address ?? "",
  };
}
// TypeScript source.
