import { Router } from "express";

export default function register() {
    return {
        name: "throwing-close-plugin",
        mountPath: "/throwing-close-plugin",
        router: Router(),
        close: async () => {
            throw new Error("teardown blew up");
        },
    };
}
