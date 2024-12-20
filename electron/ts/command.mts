import {
  app,
  BrowserWindow,
  nativeImage,
  dialog,
  Tray,
  ipcMain,
  protocol,
  net,
  Menu,
  shell,
  clipboard,
  globalShortcut,
  desktopCapturer,
  systemPreferences,
} from "electron";
import pack from "../package.json";
import { fs, os, sleep, retry, path, $ } from "zx";
import { request } from "./common/request.mjs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { exec, spawn, execFile } from "child_process";
import { Server as SocketIO } from "socket.io";
import { createServer } from "http";
import { isPortUse } from "./common/checkport.mjs";
import { closePort } from "./common/closeport.mjs";
import { execFallback } from "./common/execFallback.mjs";
import AdmZip from "adm-zip";
import { pipeline } from "stream";
import { promisify } from "util";
import puppeteer from "puppeteer-core";
import { VideoInfo } from "./common/types.mjs";
import log from "electron-log";
import { v4 as uuidV4 } from "uuid";
import Screenshots from "electron-screenshots";
import Koa from "koa";
import serve from "koa-static";
import cors from "@koa/cors";
import http from "http";
import { getLocalIP } from "./common/util.mjs";
import { autoLauncher } from "./common/autoLauncher.mjs";
import { clipboardHistoryData, electronData } from "./common/data.mjs";
import Bonjour from "bonjour-service";
import ciao from "@homebridge/ciao";
import { commandHistory, CommandStatus } from "./command_history.mjs";
import { appDataDir } from "./const.mjs";

import FfmpegCommand from "fluent-ffmpeg";

import {
  closeMcpClients,
  getMcpClients,
  openMcpClients,
} from "./mcp/config.mjs";

const userDataPath = app.getPath("userData");
let videoDownloadWin: BrowserWindow;

function logCommand(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    try {
      commandHistory.add(propertyKey, args);
      commandHistory.save();

      let res = await originalMethod.apply(this, args);
      commandHistory.last().status = CommandStatus.SUCCESS;
      commandHistory.save();
      return res;
    } catch (e) {
      commandHistory.last().status = CommandStatus.ERROR;
      commandHistory.last().error = e.message;
      commandHistory.save();
      throw e;
    }
  };
  return descriptor;
}

export class CommandFactory {
  async getHistory() {
    return commandHistory.get();
  }
  async initMcpClients(clientName: string = undefined) {
    let res = await openMcpClients(clientName);
    let obj = {};
    for (let key in res) {
      obj[key] = res[key].toJSON();
    }
    return obj;
  }
  async getMcpClients() {
    let res = await getMcpClients();
    let obj = {};
    for (let key in res) {
      obj[key] = res[key].toJSON();
    }
    return obj;
  }

  async closeMcpClients(clientName: string = undefined) {
    let res = await closeMcpClients(clientName);
    let obj = {};
    for (let key in res) {
      obj[key] = res[key].toJSON();
    }
    return obj;
  }
  async mcpCallTool(clientName: string, functionName: string, args: any) {
    let mcpClients = await getMcpClients();
    let client = mcpClients[clientName];
    if (!client) {
      throw new Error("client not found");
    }
    // console.log("mcpCallTool", client, functionName, args);
    // if (client.status == "disconnected") {
    //   await openMcpClients(clientName);
    //   let mcpClients = await getMcpClients();
    //   client = await mcpClients[clientName];
    // }
    // let tool = client.tools.find((tool) => tool.name == functionName);
    // if (!tool) {
    //   throw new Error("tool not found");
    // }
    return await client.callTool(functionName, args);
  }
  async mcpCallResource(clientName: string, uri: string) {
    let mcpClients = await getMcpClients();
    let client = mcpClients[clientName];
    if (!client) {
      throw new Error("client not found");
    }
    return await client.callResource(uri);
  }
  async mcpCallPrompt(clientName: string, functionName: string, args: any) {
    let mcpClients = await getMcpClients();
    let client = mcpClients[clientName];
    if (!client) {
      throw new Error("client not found");
    }
    return await client.callPrompt(functionName, args);
  }

  async getClipboardHistory() {
    return clipboardHistoryData.get();
  }

  async processedFilePath(filePath: string): Promise<string> {
    // 获取文件目录和文件名
    const dirName = path.dirname(filePath);
    const baseName = path.basename(filePath);
    // 获取文件名和扩展名
    const extName = path.extname(baseName);
    const fileName = path.basename(baseName, extName);
    // 构造新的文件名
    const newFileName = `${fileName}.processed${extName}`;
    // 返回新的文件路径
    return path.join(dirName, newFileName);
  }
  async selectFile(
    opts: {
      type: "openFile" | "openDirectory";
      filters?: Array<{ name: string; extensions: string[] }>;
    } = { type: "openFile" }
  ) {
    opts.type = opts.type || "openFile";
    try {
      const result = await dialog.showOpenDialog({
        properties: [opts.type],
        filters: opts.filters,
      });

      if (!result.canceled) {
        const filePath = result.filePaths[0];
        log.info("Selected file:", filePath);
        return filePath;
      } else {
        console.error("No file selected");
        return "";
      }
    } catch (error) {
      console.error("Error selecting file:", error);
      return "";
    }
  }
  // 示例：设置剪切板内容
  async setClipboardText(text: string) {
    clipboard.writeText(text);
  }
  // 示例：获取剪切板内容
  async getClipboardText(): Promise<string> {
    return clipboard.readText();
  }
  async getData(): Promise<any> {
    let { electronData: electron_data } = await import("./common/data.mjs");
    return electron_data.get();
  }
  async isAutoLauncher(): Promise<boolean> {
    return autoLauncher.isEnabled();
  }
  async enableAutoLauncher(): Promise<void> {
    return autoLauncher.enable();
  }
  async disableAutoLauncher(): Promise<void> {
    return autoLauncher.disable();
  }
  async getAppDataDir(): Promise<string> {
    return appDataDir;
  }
  async readDir(p, root = appDataDir) {
    p = path.join(root, p);
    fs.ensureDirSync(p);
    return fs.readdirSync(p);
  }
  async removeFile(p, root = appDataDir) {
    p = path.join(root, p);

    return fs.removeSync(p);
  }
  async writeFile(p, text, root = appDataDir) {
    p = path.join(root, p);
    return fs.writeFileSync(p, text);
  }
  async readFile(p, root = appDataDir) {
    p = path.join(root, p);
    try {
      return fs.readFileSync(p, "utf-8");
    } catch (e) {
      return "";
    }
  }
  async readJSON(p, root = appDataDir) {
    p = path.join(root, p);
    try {
      let str = fs.readFileSync(p, "utf-8");
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
  async exists(p, root = appDataDir) {
    p = path.join(root, p);
    return fs.exists(p);
  }

  async pathJoin(p, root = appDataDir) {
    if (root) {
      p = path.join(root, p);
    }
    fs.ensureDirSync(dirname(p));
    return p;
  }
  async getLocalIP(): Promise<string[]> {
    return getLocalIP();
  }
  async isPortUse(port: number): Promise<boolean> {
    return isPortUse(port);
  }

  async openExplorer(p) {
    return shell.showItemInFolder(p.replaceAll("/", "\\"));
  }
}

export const Command = CommandFactory.prototype;