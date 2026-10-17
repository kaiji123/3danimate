import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// WebGL in headless Chrome: ANGLE keeps three.js working on machines without a GPU.
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(4);
