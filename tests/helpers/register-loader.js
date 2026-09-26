import { register } from "node:module";

register("./server-only-loader.js", import.meta.url);
