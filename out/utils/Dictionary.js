'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class Dictionary {
    constructor() {
        this._keys = [];
        this._values = [];
    }
    put(key, value) {
        this[key] = value;
        if (this.containsKey(key)) {
            let index = this._keys.indexOf(key);
            if (index !== -1) {
                this._keys[index] = key;
            }
            else {
                this._keys.push(key);
            }
            index = this._values.indexOf(value);
            if (index !== -1) {
                this._values[index] = value;
            }
            else {
                this._values.push(value);
            }
        }
        else {
            this._keys.push(key);
            this._values.push(value);
        }
    }
    remove(key) {
        let index = this._keys.indexOf(key, 0);
        this._keys.splice(index, 1);
        this._values.splice(index, 1);
        delete this[key];
    }
    keys() {
        return this._keys;
    }
    values() {
        return this._values;
    }
    containsKey(key) {
        if (typeof this[key] === "undefined") {
            return false;
        }
        return true;
    }
}
exports.Dictionary = Dictionary;
//# sourceMappingURL=Dictionary.js.map