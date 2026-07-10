import { WebFrameMain } from "electron";
import { pathToFileURL } from "node:url";
import { getUIPath } from "./pathResolver.js";

export function isDev(): boolean {
    return process.env.NODE_ENV === "development";
}

export function validateEventFrame(frame: WebFrameMain|null){
    if(!frame || Object.keys(frame).length === 0){
        return;
    }
    if(isDev() && new URL(frame.url).host === "localhost:5123"){
        return;
    }
    if(frame.url !== pathToFileURL(getUIPath()).toString()){
        throw new Error("Malicious Event")
    }
}