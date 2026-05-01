import { Writable } from "node:stream";
import pino, { type Logger as PinoInstance } from "pino";

const ANSI = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
} as const;

const LEVEL_FORMAT: Record<number, { label: string; color: string }> = {
    10: { label: "TRACE", color: ANSI.white },
    20: { label: "DEBUG", color: ANSI.cyan },
    30: { label: "INFO", color: ANSI.green },
    40: { label: "WARN", color: ANSI.yellow },
    50: { label: "ERROR", color: ANSI.red },
    60: { label: "FATAL", color: ANSI.red },
};

const APP_NAME = process.env.APP_NAME ?? "SWGoHBotSite";

const timeFormatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "America/Los_Angeles",
});

function formatLogLine(raw: string): string {
    try {
        const obj = JSON.parse(raw);
        const level = LEVEL_FORMAT[obj.level as number] ?? { label: "UNKNOWN", color: ANSI.white };
        const msg = (obj.msg as string) ?? "";
        const time = timeFormatter.format(new Date());
        return `[${APP_NAME}] ${level.color}[${level.label}]${ANSI.reset} [${time}] ${msg}\n`;
    } catch {
        return raw;
    }
}

const prettyStream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
            process.stdout.write(formatLogLine(line));
        }
        callback();
    },
});

class Logger {
    private readonly pinoInstance: PinoInstance;
    private readonly logLevel = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "development" ? "debug" : "info");

    constructor() {
        this.pinoInstance = pino(
            {
                name: APP_NAME,
                level: this.logLevel,
                timestamp: pino.stdTimeFunctions.epochTime,
            },
            prettyStream,
        );
    }

    private stringify(content: unknown): string {
        if (typeof content === "string") return content;
        if (content instanceof Error) return content.stack ?? content.message;
        return JSON.stringify(content);
    }

    log(content: unknown): void {
        this.pinoInstance.info(this.stringify(content));
    }

    info(content: unknown): void {
        this.pinoInstance.info(this.stringify(content));
    }

    warn(content: unknown): void {
        this.pinoInstance.warn(this.stringify(content));
    }

    error(content: unknown): void {
        this.pinoInstance.error(this.stringify(content));
    }

    debug(content: unknown): void {
        this.pinoInstance.debug(this.stringify(content));
    }
}

const logger = new Logger();
export default logger;
