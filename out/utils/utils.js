"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const KEY = 'lM)tV?RNHc4!xlp!xJ( \'&oOL1MOS{\\B'; // need to have a key length of 32 byte (256 bit)
const AUTH_TAG_LENGTH = 16;
const PREFIX = '{pbe:';
const SUFFIX = '}';
const SEPARATOR = '|';
function encrypt(unencrypted) {
    if (!unencrypted || unencrypted.length <= 0)
        return unencrypted; // Nothing to do
    if (unencrypted.startsWith(PREFIX))
        return unencrypted; // Already encrypted
    let iv = crypto.randomBytes(12);
    let cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    let ciphertext = cipher.update(unencrypted, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    let tag = cipher.getAuthTag();
    let encrypted = PREFIX + [ciphertext, iv.toString('base64'), tag.toString('base64')].join(SEPARATOR) + SUFFIX;
    return encrypted;
}
exports.encrypt = encrypt;
function decrypt(encrypted) {
    if (!encrypted || encrypted.length <= 0)
        return encrypted; // Nothing to do
    if (!encrypted.startsWith(PREFIX))
        return encrypted; // Not encrypted, return it directly
    if (encrypted.charAt(encrypted.length - 1) != SUFFIX)
        return encrypted; // Not encrypted, return it directly
    let trimmed = encrypted.substring(PREFIX.length, encrypted.length - SUFFIX.length);
    let fields = trimmed.split(SEPARATOR);
    let ciphertext = fields[0];
    let iv = Buffer.from(fields[1], 'base64');
    let tag = Buffer.from(fields[2], 'base64');
    let decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    let unencrypted = decipher.update(ciphertext, 'base64', 'utf8');
    unencrypted += decipher.final('utf8');
    return unencrypted;
}
exports.decrypt = decrypt;
function stripHtml(html) {
    const TAG_BODY_START = '<body>';
    const TAG_BODY_END = '</body>';
    if (html && html.startsWith('<html>')) {
        let startIndex = html.indexOf(TAG_BODY_START);
        let endIndex = html.indexOf(TAG_BODY_END);
        if (startIndex == -1 || endIndex == -1) {
            return html;
        }
        else {
            return html.substring(startIndex + TAG_BODY_START.length, endIndex);
        }
    }
    else {
        return html;
    }
}
exports.stripHtml = stripHtml;
//# sourceMappingURL=utils.js.map