const crypto = require("crypto");

// Characters avoiding ambiguous glyphs (no 0/O, no 1/I)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length = 6) {
  let code = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function generateSessionToken() {
  return crypto.randomUUID();
}

module.exports = {
  generateRoomCode,
  generateSessionToken,
};
