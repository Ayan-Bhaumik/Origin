// Helpers for the public REST API used by the browser extension.
export const API_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...API_CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

const STATUS: Record<string, number> = {
  rate_limited: 429,
  blocked: 403,
  maintenance: 503,
  not_found: 404,
  burned: 410,
  pin_required: 401,
  wrong_pin: 401,
  locked: 423,
  taken: 409,
  too_large: 413,
  save_failed: 500,
  upload_failed: 500,
  code_failed: 500,
};

const MESSAGES: Record<string, string> = {
  rate_limited: "Too many requests. Please slow down.",
  blocked: "Access denied.",
  maintenance: "Sending is paused for maintenance.",
  not_found: "No clip found for this code, or it has expired.",
  burned: "This clip was already viewed and deleted.",
  pin_required: "This clip is protected with a PIN.",
  wrong_pin: "Wrong PIN.",
  locked: "Too many wrong PINs. Try again in 15 minutes.",
  taken: "That code is already taken.",
  too_large: "That is larger than the allowed size.",
  bad_timer: "That timer is not allowed.",
  bad_type: "That file type is not allowed.",
  bad_file: "The file could not be read.",
  empty: "Nothing to send.",
  save_failed: "Could not save the clip.",
  upload_failed: "Could not upload the file.",
  code_failed: "Could not generate a code. Try again.",
};

export function apiError(code: string, extra: Record<string, unknown> = {}) {
  const known = code in MESSAGES;
  return json({ error: known ? MESSAGES[code] : code, code: known ? code : "invalid", ...extra }, STATUS[code] ?? 400);
}
