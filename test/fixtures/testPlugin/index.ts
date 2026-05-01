import { Router } from "express";
import type { PluginContext, PluginDefinition } from "../../../types/plugin.ts";

export default function register(_ctx: PluginContext): PluginDefinition {
	const router = Router();
	router.get("/ping", (_req, res) => {
		res.json({ ok: true });
	});
	return {
		name: "test-plugin",
		mountPath: "/test-plugin",
		router,
	};
}
