import { Router } from "express";

/** Records each close() call so the test can assert the hook actually ran. */
export const closeCalls: string[] = [];

export default function register() {
    return {
        name: "closable-plugin",
        mountPath: "/closable-plugin",
        router: Router(),
        close: async () => {
            closeCalls.push("closed");
        },
    };
}
