"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const localVarRequest = require("request");
const Immutable = require("immutable");
const NodeRSA = require("node-rsa");
const os = require("os");
const ConfigLog4j_1 = require("./../utils/ConfigLog4j");
const Utils = require("./../utils/utils");
const AsyncLock = require("async-lock");
const lock = new AsyncLock();
const EXTENSION_ID = 'kiuwan.k4d-vscode';
const LICENSE_ERROR_CODE_HEADER = 'x-license-error-code';
const log = ConfigLog4j_1.LogFactory.getLogger("k4d.client.license");
// Production uses: https://www.kiuwan.com/saas/rest/license
// Custom Kiuwan like KLT uses: http://kiuwanlabtest.optimyth.com:9080/saas/rest/license
// If configured, custom server is expected to be like: http://kiuwanlabtest.optimyth.com:9080/saas
let defaultBasePath = 'https://www.kiuwan.com/saas/rest/license';
let primitives = [
    "string",
    "boolean",
    "double",
    "integer",
    "long",
    "float",
    "number",
    "any"
];
let enumsMap = {};
let typeMap = {};
class ObjectSerializer {
    static findCorrectType(data, expectedType) {
        if (data == undefined) {
            return expectedType;
        }
        else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
            return expectedType;
        }
        else if (expectedType === "Date") {
            return expectedType;
        }
        else {
            if (enumsMap[expectedType]) {
                return expectedType;
            }
            if (!typeMap[expectedType]) {
                return expectedType; // we don't know the type
            }
            // Check the discriminator
            let discriminatorProperty = typeMap[expectedType].discriminator;
            if (discriminatorProperty == null) {
                return expectedType; // the type does not have a discriminator. use it.
            }
            else {
                if (data[discriminatorProperty]) {
                    return data[discriminatorProperty]; // use the type given in the discriminator
                }
                else {
                    return expectedType; // discriminator was not present (or an empty string)
                }
            }
        }
    } // ObjectSerializer::findCorrectType
    static serialize(data, type) {
        if (data == undefined) {
            return data;
        }
        else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        }
        else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.serialize(date, subType));
            }
            return transformedData;
        }
        else if (type === "Date") {
            return data.toString();
        }
        else {
            if (enumsMap[type]) {
                return data;
            }
            if (!typeMap[type]) { // in case we dont know the type
                return data;
            }
            // get the map for the correct type.
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            let instance = {};
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
            }
            return instance;
        }
    } // ObjectSerializer::serialize
    static deserialize(data, type) {
        // polymorphism may change the actual type.
        type = ObjectSerializer.findCorrectType(data, type);
        if (data == undefined) {
            return data;
        }
        else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        }
        else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.deserialize(date, subType));
            }
            return transformedData;
        }
        else if (type === "Date") {
            return new Date(data);
        }
        else {
            if (enumsMap[type]) { // is Enum
                return data;
            }
            if (!typeMap[type]) { // dont know the type
                return data;
            }
            let instance = new typeMap[type]();
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
            }
            return instance;
        }
    } // ObjectSerializer::deserialize
} // ObjectSerializer
class HttpBasicAuth {
    applyToRequest(requestOptions) {
        requestOptions.auth = {
            username: this.username, password: this.password
        };
    }
}
exports.HttpBasicAuth = HttpBasicAuth;
class ApiKeyAuth {
    constructor(location, paramName) {
        this.location = location;
        this.paramName = paramName;
    }
    applyToRequest(requestOptions) {
        if (this.location == "query") {
            requestOptions.qs[this.paramName] = this.apiKey;
        }
        else if (this.location == "header" && requestOptions && requestOptions.headers) {
            requestOptions.headers[this.paramName] = this.apiKey;
        }
    }
}
exports.ApiKeyAuth = ApiKeyAuth;
class OAuth {
    applyToRequest(requestOptions) {
        if (requestOptions && requestOptions.headers) {
            requestOptions.headers["Authorization"] = "Bearer " + this.accessToken;
        }
    }
}
exports.OAuth = OAuth;
class VoidAuth {
    applyToRequest(_) {
        // Do nothing
    }
}
exports.VoidAuth = VoidAuth;
class KiuwanLicenseApi {
    constructor(basePathOrUsername, password, basePath) {
        this._basePath = defaultBasePath;
        this.defaultHeaders = {};
        this._useQuerystring = false;
        this.authentications = {
            'default': new VoidAuth(),
            'Cookie': new ApiKeyAuth('header', 'Cookie'),
            'basicAuth': new HttpBasicAuth(),
        };
        this.product = LicensedProduct.K4D_REMOTE_VIEW;
        if (password) {
            this.username = basePathOrUsername;
            this.password = password;
            if (basePath) {
                this.basePath = basePath;
            }
        }
        else {
            if (basePathOrUsername) {
                this.basePath = basePathOrUsername;
            }
        }
    }
    set useQuerystring(value) {
        this._useQuerystring = value;
    }
    set basePath(basePath) {
        this._basePath = basePath;
    }
    get basePath() {
        return this._basePath;
    }
    setDefaultAuthentication(auth) {
        this.authentications.default = auth;
    }
    set username(username) {
        this.authentications.basicAuth.username = username;
    }
    set password(password) {
        this.authentications.basicAuth.password = password;
    }
    getLicenseLocked() {
        return __awaiter(this, void 0, void 0, function* () {
            // This variable is local to each KiuwanLicenseApi instance, so no race-conditions on it
            let checkLicense;
            try {
                // Lock on KiuwanLicenseApi.CHECKING_LICENSE static variable and update our local var based on its value
                yield lock.acquire('KiuwanLicenseApi.CHECKING_LICENSE', function () {
                    if (KiuwanLicenseApi.CHECKING_LICENSE) {
                        // if any other instance is checking the license, we are gonna skip it
                        checkLicense = false;
                    }
                    else {
                        // if nobody is checking it, then we'll check it (and update shared variable's value)
                        checkLicense = true;
                        KiuwanLicenseApi.CHECKING_LICENSE = true;
                    }
                });
                if (checkLicense) {
                    yield this.getLicense();
                }
            }
            catch (error) {
                throw error;
            }
            finally {
                // Lock once again on KiuwanLicenseApi.CHECKING_LICENSE to update its value and let others check the license
                yield lock.acquire('KiuwanLicenseApi.CHECKING_LICENSE', function () {
                    KiuwanLicenseApi.CHECKING_LICENSE = false;
                });
            }
        });
    }
    /**
     * Try to consume a new floating license if not yet consumed or already expired, or renew it otherwise.
     */
    getLicense() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.product.getToken()) {
                let license;
                try {
                    license = License.fromString(this.product.getToken());
                }
                catch (error) {
                    log.warn('Error parsing license from token, trying to consume new one as current might be corrupt');
                    yield this.consume();
                    return;
                }
                if (license.isExpired()) {
                    log.info('Licence has expired, try consuming new one');
                    yield this.consume();
                    return;
                }
                else if (license.needsRenewal(KiuwanLicenseApi.RENEWAL_MINUTES)) {
                    log.info('License is about to expire, renew current license');
                    yield this.renew();
                    return;
                }
                else {
                    log.info('License not yet expired, check its validity');
                    LicenseChecker.getKiuwanInstance().check(this.product.getToken());
                    return;
                }
            }
            else {
                log.info('No license token yet, consume new one');
                yield this.consume();
                return;
            }
        });
    }
    /**
     * If some consumed licensed is detected, request license API to release it.
     */
    ungetLicense() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.product.getToken()) {
                try {
                    let license = License.fromString(this.product.getToken());
                    if (!license.isExpired()) {
                        log.info('License not yet expired, try releasing it');
                        yield this.release();
                    }
                }
                catch (error) {
                    log.warn('Error parsing license from token when trying to release it, current might be corrupt, do nothing');
                    if (error.stack) {
                        log.error(error.stack);
                    }
                    else {
                        log.error(error);
                    }
                }
            }
        });
    }
    // TODO refactor consume/renew/release methods extracting common http request logic and returning promises
    consume() {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`Floating license consume operation in progress...`);
            const localVarPath = this.basePath + '/create';
            let localVarQueryParameters = {};
            let localVarHeaderParams = Object.assign({}, this.defaultHeaders);
            let localVarFormParams = {};
            // TODO when we add SSO support, if requests begin to fail, maybe we have to store and inject CSRF token as in other K4Ds
            // e.g. seen debugging: result.response.headers['x-csrf-token'] = "c78f54be-dfc6-44b5-bb07-247eb7fb26c0"
            // e.g. seen debugging: result.response.headers["set-cookie"] = Array(1) with following entry inside
            //                      "JSESSIONID=_2G8w1guHk8ONNult4yAUwWWbUGOeeCFzQm_SeRV.kiuwanlabtest; path=/saas; HttpOnly"
            // i.e. use "localVarHeaderParams['X-CSRF-TOKEN'] = '';" or something similar
            localVarHeaderParams['User-Agent'] = this.product.getProductHeader();
            localVarHeaderParams['Content-Type'] = 'application/x-www-form-urlencoded';
            localVarHeaderParams['Accept'] = 'text/plain';
            localVarQueryParameters['subject'] = null;
            localVarQueryParameters['password'] = null;
            localVarQueryParameters['product'] = this.product.getId();
            let localVarUseFormData = false;
            let localVarRequestOptions = {
                method: 'POST',
                qs: localVarQueryParameters,
                headers: localVarHeaderParams,
                uri: localVarPath,
                useQuerystring: this._useQuerystring,
                json: false,
            };
            this.authentications.Cookie.applyToRequest(localVarRequestOptions);
            this.authentications.basicAuth.applyToRequest(localVarRequestOptions);
            this.authentications.default.applyToRequest(localVarRequestOptions);
            if (Object.keys(localVarFormParams).length) {
                if (localVarUseFormData) {
                    localVarRequestOptions.formData = localVarFormParams;
                }
                else {
                    localVarRequestOptions.form = localVarFormParams;
                }
            }
            try {
                let result = yield new Promise((resolve, reject) => {
                    localVarRequest(localVarRequestOptions, (error, response, body) => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            body = ObjectSerializer.deserialize(body, 'string');
                            if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
                                resolve({ response: response, body: body });
                            }
                            else {
                                reject({ response: response, body: body });
                            }
                        }
                    });
                });
                if (result.body) {
                    this.product.setToken(result.body);
                    let msg = 'Floating license consumed with ID ' + result.response.headers['x-floating-license-id'];
                    log.info(msg);
                    log.debug(`Token for product ${this.product.getId()} is ${this.product.getToken()}`);
                    LicenseChecker.getKiuwanInstance().check(this.product.getToken());
                }
                else if (result.response) {
                    let msg = `Consume operation completed but license data is missing (HTTP status = ${result.response.statusCode} - ${result.response.statusMessage})`;
                    throw new LicenseError(msg, LicenseErrorKind.ILLEGAL_CONTENTS);
                }
            }
            catch (error) {
                if (error.body && error.response) {
                    if (error.response.headers && error.response.headers[LICENSE_ERROR_CODE_HEADER]) {
                        let kindStr = error.response.headers[LICENSE_ERROR_CODE_HEADER];
                        let kind = LicenseErrorKind[kindStr];
                        let kindMsg = LicenseError.getKindMessage(kind);
                        let message = kindMsg ? `${error.body} (${kindMsg})` : error.body;
                        throw new LicenseError(message, kind);
                    }
                    else {
                        throw new LicenseError(error.body, LicenseErrorKind.GENERIC_ERROR);
                    }
                }
                else {
                    throw error;
                }
            }
        });
    }
    renew() {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`Floating license renew operation in progress...`);
            const localVarPath = this.basePath + '/renew';
            let localVarQueryParameters = {};
            let localVarHeaderParams = Object.assign({}, this.defaultHeaders);
            let localVarFormParams = {};
            localVarHeaderParams['User-Agent'] = this.product.getProductHeader();
            localVarHeaderParams['Content-Type'] = 'application/x-www-form-urlencoded';
            localVarHeaderParams['Accept'] = 'text/plain';
            localVarQueryParameters['subject'] = null;
            localVarQueryParameters['password'] = null;
            localVarQueryParameters['product'] = this.product.getId();
            let localVarUseFormData = false;
            let localVarRequestOptions = {
                method: 'POST',
                qs: localVarQueryParameters,
                headers: localVarHeaderParams,
                uri: localVarPath,
                useQuerystring: this._useQuerystring,
                json: false,
            };
            this.authentications.Cookie.applyToRequest(localVarRequestOptions);
            this.authentications.basicAuth.applyToRequest(localVarRequestOptions);
            this.authentications.default.applyToRequest(localVarRequestOptions);
            if (Object.keys(localVarFormParams).length) {
                if (localVarUseFormData) {
                    localVarRequestOptions.formData = localVarFormParams;
                }
                else {
                    localVarRequestOptions.form = localVarFormParams;
                }
            }
            try {
                let result = yield new Promise((resolve, reject) => {
                    localVarRequest(localVarRequestOptions, (error, response, body) => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            body = ObjectSerializer.deserialize(body, 'string');
                            if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
                                resolve({ response: response, body: body });
                            }
                            else {
                                reject({ response: response, body: body });
                            }
                        }
                    });
                });
                if (result.body) {
                    this.product.setToken(result.body);
                    let msg = 'Floating license renewed with ID ' + result.response.headers['x-floating-license-id'];
                    log.info(msg);
                    log.debug(`Token for product ${this.product.getId()} is ${this.product.getToken()}`);
                    LicenseChecker.getKiuwanInstance().check(this.product.getToken());
                }
                else if (result.response) {
                    let msg = `Renew operation completed but new license data is missing (HTTP status = ${result.response.statusCode} - ${result.response.statusMessage})`;
                    throw new LicenseError(msg, LicenseErrorKind.ILLEGAL_CONTENTS);
                }
            }
            catch (error) {
                if (error.body && error.response) {
                    if (error.response.headers && error.response.headers[LICENSE_ERROR_CODE_HEADER]) {
                        let kindStr = error.response.headers[LICENSE_ERROR_CODE_HEADER];
                        let kind = LicenseErrorKind[kindStr];
                        let kindMsg = LicenseError.getKindMessage(kind);
                        let message = kindMsg ? `${error.body} (${kindMsg})` : error.body;
                        throw new LicenseError(message, kind);
                    }
                    else {
                        throw new LicenseError(error.body, LicenseErrorKind.GENERIC_ERROR);
                    }
                }
                else {
                    throw error;
                }
            }
        });
    }
    release() {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`Floating license release operation in progress...`);
            const localVarPath = this.basePath + '/release';
            let localVarQueryParameters = {};
            let localVarHeaderParams = Object.assign({}, this.defaultHeaders);
            let localVarFormParams = {};
            localVarHeaderParams['User-Agent'] = this.product.getProductHeader();
            localVarHeaderParams['Content-Type'] = 'application/x-www-form-urlencoded';
            localVarHeaderParams['Accept'] = 'text/plain';
            localVarQueryParameters['subject'] = null;
            localVarQueryParameters['password'] = null;
            localVarQueryParameters['product'] = this.product.getId();
            let localVarUseFormData = false;
            let localVarRequestOptions = {
                method: 'POST',
                qs: localVarQueryParameters,
                headers: localVarHeaderParams,
                uri: localVarPath,
                useQuerystring: this._useQuerystring,
                json: false,
            };
            this.authentications.Cookie.applyToRequest(localVarRequestOptions);
            this.authentications.basicAuth.applyToRequest(localVarRequestOptions);
            this.authentications.default.applyToRequest(localVarRequestOptions);
            if (Object.keys(localVarFormParams).length) {
                if (localVarUseFormData) {
                    localVarRequestOptions.formData = localVarFormParams;
                }
                else {
                    localVarRequestOptions.form = localVarFormParams;
                }
            }
            try {
                yield new Promise((resolve, reject) => {
                    localVarRequest(localVarRequestOptions, (error, response, body) => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            body = ObjectSerializer.deserialize(body, 'string');
                            if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
                                resolve({ response: response, body: body });
                            }
                            else {
                                reject({ response: response, body: body });
                            }
                        }
                    });
                });
                this.product.setToken(null);
                let msg = 'Floating license successfully released';
                log.info(`${msg} (token for product ${this.product.getId()} set to null)`);
            }
            catch (error) {
                if (error.body && error.response) {
                    if (error.response.headers && error.response.headers[LICENSE_ERROR_CODE_HEADER]) {
                        let kindStr = error.response.headers[LICENSE_ERROR_CODE_HEADER];
                        let kind = LicenseErrorKind[kindStr];
                        let kindMsg = LicenseError.getKindMessage(kind);
                        let message = kindMsg ? `${error.body} (${kindMsg})` : error.body;
                        throw new LicenseError(message, kind);
                    }
                    else {
                        throw new LicenseError(error.body, LicenseErrorKind.GENERIC_ERROR);
                    }
                }
                else {
                    throw error;
                }
            }
        });
    }
}
KiuwanLicenseApi.RENEWAL_MINUTES = 60;
/** We'll use this shared variable as a monitor to avoid checking the license concurrently. */
KiuwanLicenseApi.CHECKING_LICENSE = false;
exports.KiuwanLicenseApi = KiuwanLicenseApi;
class LicenseChecker {
    constructor(cryptoServiceProvider) {
        this.cryptoServiceProvider = cryptoServiceProvider;
    }
    /**
     * Get LicenseChecker instance with Kiuwan current public key.
     * @returns Kiuwan license checker.
     * @throws LicenseError if bad public key or validation algorithm.
     */
    static getKiuwanInstance() {
        if (!LicenseChecker.KIUWAN_INSTANCE) {
            LicenseChecker.KIUWAN_INSTANCE = LicenseChecker.getInstance(LicenseChecker.KIUWAN_KEY);
        }
        return LicenseChecker.KIUWAN_INSTANCE;
    }
    /**
     * Get LicenseChecker instance with specified public key.
     * @param publicKey
     * @returns License checker for given public key.
     * @throws LicenseError if bad public key or validation algorithm.
     */
    static getInstance(publicKey) {
        try {
            // Java's LicenseChecker loads a Signature object using 'SHA1WithRSA' as param (RSA is pkcs1)
            let options = { environment: 'node', encryptionScheme: 'pkcs1', signingScheme: 'pkcs1-sha1' };
            // If we inspect public key we'll see that its OID is '1.2.840.113549.1.1.1' (rsaEncryption)
            // But since it contains some ASN.1 headers with AlgorithmIdentifier, and not just public key's modulus and exponent, it's in fact pkcs8 format
            let cryptoServiceProvider = new NodeRSA(publicKey, 'pkcs8-public-pem', options);
            return new LicenseChecker(cryptoServiceProvider);
        }
        catch (error) {
            log.error(error.stack);
            throw new LicenseError(License.MSG_BAD_KEY, LicenseErrorKind.BAD_KEY, error);
        }
    }
    /**
     * Validates given license.
     * @param token License text.
     * @returns License data.
     * @throws LicenseError if license is not valid (bad key or integrity, wrong host or time range, etc).
     */
    check(token) {
        // integrity check on the signature of the license
        let lic = this.verifySignature(token);
        // common verifications on license contents
        TimeRangeChecker.INSTANCE.validate(lic.licenseData);
        HostChecker.INSTANCE.validate(lic.licenseData);
        return lic.licenseData;
    }
    verifySignature(token) {
        let license;
        let valid = false;
        try {
            license = License.fromString(token);
            let data = license.licenseData;
            let dataStr = data.toString();
            // Java's LicenseChecker updates a buffer as we call the method 'update'; concat data and salt as we do in .net
            valid = this.cryptoServiceProvider.verify(dataStr + license.nonce, license.signature);
            // ALTERNATIVE: documented for common knowledge and just in case everything starts failing => Node.js crypto package
            /*
            // First, use NodeRSA to export pkcs8 public pem key as pkcs1 public pem, it doesn't work with pkcs8
            let transformedPublicKey: string = this.cryptoServiceProvider.exportKey('pkcs1-public-pem')
            // Then, create a Verify object with algorythm needed (remember that Java uses 'SHA1WithRSA' string as param)
            // NOTE: verifiers cannot be reused, create new one each time you want to verify something
            // You'll have to add -- import * as crypto from 'crypto'; -- to have access to proper crypto library
            let verify: crypto.Verify = crypto.createVerify('sha1WithRSAEncryption');
            // Finally, update verifier with data and salt, and invoke verify method with pkcs1 public key and signature
            valid = verify.update(dataStr).update(license.nonce).verify(transformedPublicKey, license.signature);
            // NOTE: if you use a Buffer, no signature encoding is needed; if you use a string, equivalent encoding param is needed
            valid = verify.update(dataStr).update(license.nonce).verify(transformedPublicKey, license.signature.toString('base64'), 'base64');
            valid = verify.update(dataStr).update(license.nonce).verify(transformedPublicKey, license.signature.toString('latin1'), 'latin1');
            valid = verify.update(dataStr).update(license.nonce).verify(transformedPublicKey, license.signature.toString('hex'), 'hex');
            */
        }
        catch (error) {
            log.error('Error verifying signature: ' + error.stack);
            throw new LicenseError(License.MSG_NO_VALID_ALGORITHM, LicenseErrorKind.GENERIC_ERROR, error);
        }
        if (valid) {
            log.info('License integrity successfully checked!');
            return license;
        }
        else {
            log.error(License.MSG_BAD_INTEGRITY + ', token is not valid');
            throw new LicenseError(License.MSG_BAD_INTEGRITY, LicenseErrorKind.BAD_INTEGRITY);
        }
    }
} // LicenseChecker
LicenseChecker.KIUWAN_KEY = 'MIHfMA0GCSqGSIb3DQEBAQUAA4HNADCByQKBwQCElepomhrzGca/OQgJqIW+AT/iAdsvOF66w9Y7abAtAU8wBafo/P3QtKec31EanAH4DGoBx1r5d38dTgu48J78hgg9FfyM62fhpFZhSK/Zz2topXvD5pL0K4gb33xs4Lah5fXMH/7Cwncc9RlwH4VinFGVmpIDXxl4ZKQ8PM9pVHfI+/woPCnkFwv54DzF6fpVUHNG32nFz9tmdxDbjFLOoG+nSSyqteiAfihPxv/NFJ9eTeA/BWErfurKH1eifyMCAwEAAQ==';
class TimeRangeChecker {
    validate(data) {
        if (data.getIsTemporal()) {
            let now = Date.now();
            if (now < data.getMinValidity()) {
                throw new LicenseError(License.MSG_TEMPORAL_LICENSE_NOT_VALID_YET, LicenseErrorKind.ILLEGAL_TIME_RANGE);
            }
            if (now > data.getMaxValidity()) {
                throw new LicenseError(License.MSG_TEMPORAL_LICENSE_EXPIRED, LicenseErrorKind.ILLEGAL_TIME_RANGE);
            }
        }
    }
} // LicenseChecker
TimeRangeChecker.INSTANCE = new TimeRangeChecker();
class HostChecker {
    /**
     * NOTE: We have checked that serverData is always null, so this HostChecker doesn't check a thing.
     * We think that this checked was thought for ChecKing - QaKing lifecycle and it doesn't make sense in Kiuwan.
     * If serverData came with value in the future, all kind of K4Ds and KLA will start to fail... probably.
     * @param data LicenseData
     */
    validate(data) {
        let serverData = data.getHostInfo();
        if (!serverData)
            return;
        let pos = serverData.indexOf(':');
        let netface = serverData.substring(0, pos);
        let ipAdd = serverData.substring(pos + 1);
        try {
            let ifaces = os.networkInterfaces()[netface];
            if (ifaces) {
                let matched = false;
                ifaces.forEach(iface => {
                    if (ipAdd == iface.address) {
                        matched = true;
                    }
                });
                if (!matched) {
                    throw new LicenseError(License.MSG_INVALID_MACHINE + ': ' + serverData, LicenseErrorKind.INVALID_MACHINE);
                }
            }
            else {
                throw new LicenseError(License.MSG_INVALID_MACHINE_NO_INTF + netface, LicenseErrorKind.INVALID_MACHINE);
            }
        }
        catch (error) {
            throw new LicenseError(License.MSG_INVALID_MACHINE_NO_INTF + netface, LicenseErrorKind.INVALID_MACHINE, error);
        }
    }
} // HostChecker
HostChecker.INSTANCE = new HostChecker();
class LicensedProduct {
    constructor(id) {
        this._id = id;
    }
    getId() { return this._id; }
    getToken() { return this.token; }
    setToken(token) { this.token = token; }
    getVersion() { return this.version; }
    setVersion(version) { this.version = version; }
    /**
     * Java returns something like "KiuwanForDevelopersRemoteView/development.356 (Java/1.8.0_121; Windows 10 10.0)".
     *
     * VSCode will return something like "KiuwanForDevelopersRemoteView/2.8.190401121520 (VisualStudioCode 1.31.1; Node.js 10.2.0; Platform win32)".
     */
    getProductHeader() {
        return this.getId() + this.getExtensionVersion() + this.getSystemInfo();
    }
    /**
     * Try to extract K4D for VSCode version from System.
     */
    getExtensionVersion() {
        let productVersion = null;
        try {
            let myExtension = vscode.extensions.getExtension(EXTENSION_ID);
            if (myExtension) {
                productVersion = '/' + myExtension.packageJSON.version;
            }
            else {
                productVersion = '/???';
            }
        }
        catch (error) {
            log.error('Failed to get package.json version: ' + error.stack);
            productVersion = '/???';
        }
        return productVersion;
    }
    /**
     * Collect IDE and OS versions.
     */
    getSystemInfo() {
        let vscodeVersion = '???';
        let nodejsVersion = '???';
        let platformVersion = '???';
        try {
            vscodeVersion = vscode.version;
            nodejsVersion = process.version;
            platformVersion = process.platform;
        }
        catch (error) {
            log.error('Failed to get system info: ' + error.stack);
        }
        return ' (VisualStudioCode ' + vscodeVersion + '; Node.js ' + nodejsVersion + '; Platform ' + platformVersion + ')';
    }
}
LicensedProduct.K4D_REMOTE_VIEW = new LicensedProduct('KiuwanForDevelopersRemoteView');
class License {
    constructor(licenseData, signature, nonce) {
        this.licenseData = licenseData;
        this.signature = signature;
        this.nonce = nonce;
    }
    static fromString(token) {
        try {
            token = token.trim();
            let p1 = token.indexOf('|');
            let p2 = token.lastIndexOf('|');
            let licData = Buffer.from(token.substring(0, p1), 'base64').toString();
            let data = LicenseData.fromString(licData);
            // CAREFUL!!! It's not needed, nor recommended, to parse string into number and later back into string! It even leads to rounding errors!
            let nonce = token.substring(p1 + 1, p2);
            let signature = token.substring(p2 + 1);
            let sigBytes = Buffer.from(signature, 'base64');
            return new License(data, sigBytes, nonce);
        }
        catch (error) {
            throw new LicenseError('Error parsing token, it might be corrupted', LicenseErrorKind.ILLEGAL_CONTENTS);
        }
    }
    /** Return true if temporal license is expired right now. */
    isExpired() { return this.licenseData.isExpired(); }
    /** Return true if license will need renewal up to minutes from now. */
    needsRenewal(minutes) { return this.licenseData.needsRenewal(minutes); }
    /** Dumps license to opaque token for external handling. */
    toString() {
        let result = '';
        let licData = this.licenseData.toString();
        result += Buffer.from(licData).toString('base64');
        result += '|' + this.nonce;
        result += '|' + Buffer.from(this.signature).toString('base64');
        return result;
    }
} // License
License.MSG_BAD_KEY = 'Cannot load key for license validation';
License.MSG_INVALID_CREDENTIALS = 'Invalid account credentials';
License.MSG_ILLEGAL_CONTENTS = 'Illegal license format or contents: ';
License.MSG_BAD_KEY_GEN = 'Cannot load key for license generation';
License.MSG_NO_VALID_ALGORITHM = 'No valid algorithm for license validation';
License.MSG_BAD_INTEGRITY = 'License integrity failure';
License.MSG_TEMPORAL_LICENSE_NOT_VALID_YET = 'Temporal license not valid yet';
License.MSG_TEMPORAL_LICENSE_EXPIRED = 'Temporal license expired';
License.MSG_ILLEGAL_TIME_RANGE = 'Temporal license is out of valid time range';
License.MSG_ILLEGAL_FEATURE = 'This license is not valid for requested feature';
License.MSG_INVALID_MACHINE = 'Host machine does not match license';
License.MSG_INVALID_MACHINE_NO_INTF = 'Host machine does not contain network interface: ';
License.MSG_MAX_LICENSE_COUNT_EXCEEDED = 'Maximum number of concurrent licenses exceeded';
License.MSG_CANNOT_SAVE_LICENSE = 'Cannot save license file: ';
License.MSG_CANNOT_FETCH_NEW_LICENSE_FROM_SERVER = 'Cannot fetch license from server: ';
class LicenseData {
    constructor(subject) {
        this.subject = subject;
        this.generatedTime = Date.now();
    }
    static fromString(licData) {
        let fields = licData.split('#');
        let p = 0;
        let subject = fields[p++];
        let data = new LicenseData(subject);
        data.generatedTime = new Number(fields[p++]).valueOf();
        data.isTemporal = new Boolean(fields[p++]).valueOf();
        if (data.isTemporal) {
            data.minValidity = new Number(fields[p++]).valueOf();
            data.maxValidity = new Number(fields[p++]).valueOf();
        }
        data.hostInfo = fields[p++];
        if ('null' == data.hostInfo)
            data.hostInfo = null;
        let tempMap = new Map();
        data.featuresOriginal = '';
        for (let i = p; i < fields.length; i++) {
            let kv = fields[i];
            let pos = kv.indexOf(':');
            let key = kv.substring(0, pos);
            let val = kv.substring(pos + 1);
            tempMap.set(key, val);
            data.featuresOriginal += '#' + key + ':' + val;
        }
        data.setFeatures(Immutable.Map(tempMap));
        return data;
    }
    getSubject() { return this.subject; }
    getIssuer() { return 'Optimyth'; }
    getGeneratedTime() { return this.generatedTime; }
    getFeatures() { return this.features; }
    getFeaturesOriginal() { return this.featuresOriginal; }
    setFeatures(features) {
        this.features = features != null ? features : Immutable.Map();
    }
    getIsTemporal() { return this.isTemporal; }
    getMinValidity() { return this.minValidity; }
    getMaxValidity() { return this.maxValidity; }
    getHostInfo() { return this.hostInfo; }
    /** Return true if this is a temporal license and now not in valid time range. */
    isExpired() {
        if (!this.getIsTemporal())
            return false;
        let now = Date.now();
        return now < this.getMinValidity() || this.getMaxValidity() < now;
    }
    /** Return true if this is a temporal license and is expired or is going to expire in minutes specified. */
    needsRenewal(minutes) {
        if (!this.getIsTemporal())
            return false;
        let now = Date.now();
        let past = now + minutes * 60 * 1000;
        return now < this.getMinValidity() || this.getMaxValidity() < past;
    }
    toString() {
        let result = '';
        result += this.getSubject();
        result += '#' + this.getGeneratedTime();
        result += '#' + this.getIsTemporal();
        if (this.getIsTemporal()) {
            result += '#' + this.getMinValidity() + '#' + this.getMaxValidity();
        }
        result += '#' + this.getHostInfo();
        if (this.getFeaturesOriginal() != null && this.getFeaturesOriginal().length > 0) {
            result += this.getFeaturesOriginal();
        }
        return result;
    }
} // LicenseData
var LicenseErrorKind;
(function (LicenseErrorKind) {
    LicenseErrorKind[LicenseErrorKind["BAD_KEY"] = 0] = "BAD_KEY";
    LicenseErrorKind[LicenseErrorKind["GENERIC_ERROR"] = 1] = "GENERIC_ERROR";
    LicenseErrorKind[LicenseErrorKind["BAD_INTEGRITY"] = 2] = "BAD_INTEGRITY";
    LicenseErrorKind[LicenseErrorKind["ILLEGAL_CONTENTS"] = 3] = "ILLEGAL_CONTENTS";
    LicenseErrorKind[LicenseErrorKind["INVALID_CREDENTIALS"] = 4] = "INVALID_CREDENTIALS";
    LicenseErrorKind[LicenseErrorKind["ILLEGAL_TIME_RANGE"] = 5] = "ILLEGAL_TIME_RANGE";
    LicenseErrorKind[LicenseErrorKind["INVALID_MACHINE"] = 6] = "INVALID_MACHINE";
    LicenseErrorKind[LicenseErrorKind["ILLEGAL_FEATURE"] = 7] = "ILLEGAL_FEATURE";
    LicenseErrorKind[LicenseErrorKind["MAX_LICENSE_COUNT_EXCEEDED"] = 8] = "MAX_LICENSE_COUNT_EXCEEDED"; // max number of concurrent licenses exceeded
})(LicenseErrorKind || (LicenseErrorKind = {}));
class LicenseError extends Error {
    constructor(message, kind, cause) {
        // try to strip HTML because some messages from responses are web pages
        super(Utils.stripHtml(message));
        // the parent constructor also sets the name property to 'Error', so we reset it to the right value
        this.name = 'LicenseError';
        this.kind = kind;
        this.cause = cause;
    }
    static getKindMessage(kind) {
        switch (kind) {
            case LicenseErrorKind.BAD_KEY:
                return License.MSG_BAD_KEY;
            case LicenseErrorKind.BAD_INTEGRITY:
                return License.MSG_BAD_INTEGRITY;
            case LicenseErrorKind.ILLEGAL_CONTENTS:
                return License.MSG_ILLEGAL_CONTENTS;
            case LicenseErrorKind.INVALID_CREDENTIALS:
                return License.MSG_INVALID_CREDENTIALS;
            case LicenseErrorKind.ILLEGAL_TIME_RANGE:
                return License.MSG_ILLEGAL_TIME_RANGE;
            case LicenseErrorKind.INVALID_MACHINE:
                return License.MSG_INVALID_MACHINE;
            case LicenseErrorKind.ILLEGAL_FEATURE:
                return License.MSG_ILLEGAL_FEATURE;
            case LicenseErrorKind.MAX_LICENSE_COUNT_EXCEEDED:
                return License.MSG_MAX_LICENSE_COUNT_EXCEEDED;
            case LicenseErrorKind.GENERIC_ERROR:
            default:
                return '';
        }
    }
}
exports.LicenseError = LicenseError;
//# sourceMappingURL=license.js.map