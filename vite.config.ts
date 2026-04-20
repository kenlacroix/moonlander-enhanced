import { defineConfig } from "vite";

export default defineConfig({
	assetsInclude: ["**/*.glsl"],
	server: {
		allowedHosts: [".ts.net"],
	},
});
