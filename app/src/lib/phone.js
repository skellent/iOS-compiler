export const DEFAULT_COUNTRY_CODE = "+1";

// Ordered roughly by how likely this app's audience is to need them —
// Spanish-speaking countries first, then a handful of other common ones.
export const COUNTRY_CODES = [
  { code: "+1", country: "US/CA" },
  { code: "+34", country: "ES" },
  { code: "+52", country: "MX" },
  { code: "+54", country: "AR" },
  { code: "+57", country: "CO" },
  { code: "+56", country: "CL" },
  { code: "+51", country: "PE" },
  { code: "+58", country: "VE" },
  { code: "+593", country: "EC" },
  { code: "+502", country: "GT" },
  { code: "+503", country: "SV" },
  { code: "+504", country: "HN" },
  { code: "+505", country: "NI" },
  { code: "+506", country: "CR" },
  { code: "+507", country: "PA" },
  { code: "+591", country: "BO" },
  { code: "+595", country: "PY" },
  { code: "+598", country: "UY" },
  { code: "+55", country: "BR" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" },
];

const _codesByLength = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

export function sanitizePhoneDigits(value) {
  return value.replace(/\D/g, "");
}

// Splits a stored phone (e.g. "+34612345678") back into a country code the
// <select> can preselect and the plain digits for the number input — needed
// whenever a contact/user with an existing phone is loaded into the form.
export function splitPhone(fullPhone) {
  const value = (fullPhone ?? "").trim();
  const match = _codesByLength.find((entry) => value.startsWith(entry.code));
  if (match) return { countryCode: match.code, number: sanitizePhoneDigits(value.slice(match.code.length)) };
  return { countryCode: DEFAULT_COUNTRY_CODE, number: sanitizePhoneDigits(value) };
}

export function combinePhone(countryCode, number) {
  return `${countryCode}${sanitizePhoneDigits(number)}`;
}

export function buildCountryCodeOptions(selectedCode) {
  return COUNTRY_CODES.map(
    ({ code, country }) => `<option value="${code}" ${code === selectedCode ? "selected" : ""}>${code} ${country}</option>`
  ).join("");
}

// Strips anything that isn't a digit as the user types, so pasted or
// hand-typed numbers with spaces/dashes/parentheses never reach the API.
export function attachPhoneSanitizer(input) {
  input.addEventListener("input", () => {
    const digitsOnly = sanitizePhoneDigits(input.value);
    if (digitsOnly !== input.value) input.value = digitsOnly;
  });
}
