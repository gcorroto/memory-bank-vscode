'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigLog4j_1 = require("./utils/ConfigLog4j");
const log = ConfigLog4j_1.LogFactory.getLogger("k4d.PaginatedDefectsCompiler");
class PaginatedDefectsCompiler {
    setPageFunction(pageFunction) {
        this.pageFunction = pageFunction;
    }
    get(limit) {
        return __awaiter(this, void 0, void 0, function* () {
            // Init variables to first page, count within server constraints ([1,5000] at the moment), and loop termination flags
            let defectBeans = [];
            let page = 1;
            let count = 1000;
            let defectsRemaining = true;
            let limitReached = false;
            // While more defects to retrieve AND not limit reached (if any): update limit flag - get next page - update defects remaining flag - repeat
            while (defectsRemaining && !limitReached) {
                if (limit != null && defectBeans.length + count == limit) {
                    limitReached = true;
                }
                else if (limit != null && defectBeans.length + count > limit) {
                    limitReached = true;
                    count = limit - defectBeans.length;
                }
                log.info(`Querying for page ${page} count ${count} ...`);
                let defectBeansBatch = yield this.pageFunction(page, count);
                if (defectBeansBatch == null || defectBeansBatch.length < count) {
                    defectsRemaining = false;
                }
                if (defectBeansBatch != null) {
                    defectBeans = defectBeans.concat(defectBeansBatch);
                }
                page++;
                if (defectBeansBatch != null) {
                    log.info(`... added ${defectBeansBatch.length} defects more to a total of ${defectBeans.length}`);
                }
            }
            // Return all collected defects (either there are no more, or user limited and limit has been reached)
            return defectBeans;
        });
    }
}
exports.PaginatedDefectsCompiler = PaginatedDefectsCompiler;
//# sourceMappingURL=PaginatedDefectsCompiler.js.map