"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const ts_log_debug_1 = require("ts-log-debug");
class LogFactory {
    static getLogger(loggerName) {
        let logger = new ts_log_debug_1.Logger(loggerName);
        logger.appenders
            .set("console-log", {
            type: "console",
            layout: { type: "colored" }
        })
            .set("file-log", {
            type: "file",
            filename: `${LogFactory.USER_HOME}/.optimyth/k4d-vscode.log`,
            layout: { type: "basic" }
        });
        return logger;
    }
}
LogFactory.USER_HOME = os.homedir();
exports.LogFactory = LogFactory;
//# sourceMappingURL=ConfigLog4j.js.map