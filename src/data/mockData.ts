import {
  BookOpen,
  Braces,
  FileArchive,
  FileText,
  Folder,
  Image,
  KeyRound,
  Lightbulb,
  Link,
  Terminal,
} from "lucide-react";
import type { Activity, Item, Metric } from "../types";

export const mockItems: Item[] = [
  {
    id: "deploy-command",
    type: "command",
    title: "服务器部署命令",
    summary: "sudo systemctl restart nginx && docker compose up -d",
    tags: [{ name: "服务器", color: "green" }],
    time: "刚刚",
    icon: Terminal,
    accent: "cyan",
    encrypted: true,
    pinned: true,
  },
  {
    id: "github-account",
    type: "password",
    title: "Github 账号",
    summary: "octocat@example.com · 密码已隐藏",
    tags: [{ name: "密码", color: "purple" }],
    time: "5 分钟前",
    icon: KeyRound,
    accent: "purple",
    encrypted: true,
  },
  {
    id: "tauri-doc",
    type: "link",
    title: "Tauri 文档",
    summary: "https://tauri.app/zh-cn/",
    tags: [{ name: "链接", color: "blue" }],
    time: "30 分钟前",
    icon: Link,
    accent: "blue",
  },
  {
    id: "family-files",
    type: "file",
    title: "家庭证件资料",
    summary: "12 个文件 · 身份证、银行卡、合同",
    tags: [{ name: "文件", color: "yellow" }],
    time: "1 小时前",
    icon: Folder,
    accent: "yellow",
    encrypted: true,
  },
  {
    id: "side-window",
    type: "note",
    title: "灵感：桌面小窗交互",
    summary: "支持任意内容快速记录，呼出即用",
    tags: [{ name: "灵感", color: "purple" }],
    time: "2 小时前",
    icon: Lightbulb,
    accent: "purple",
    pinned: true,
  },
];

export const pinnedItems: Item[] = [
  {
    id: "project-start",
    type: "note",
    title: "项目启动资料",
    summary: "本项目旨在搭建一套高可用、高性能的后端服务体系...",
    tags: [
      { name: "项目", color: "green" },
      { name: "文档", color: "blue" },
    ],
    time: "1 分钟前",
    icon: FileText,
    accent: "green",
    favorite: true,
  },
  {
    id: "tauri-doc-card",
    type: "link",
    title: "Tauri 文档",
    summary: "https://tauri.app/zh-cn/",
    tags: [{ name: "链接", color: "blue" }],
    time: "30 分钟前",
    icon: Link,
    accent: "blue",
  },
  {
    id: "contract",
    type: "file",
    title: "服务器部署合同.pdf",
    summary: "PDF · 2.4 MB",
    tags: [{ name: "合同", color: "blue" }],
    time: "1 小时前",
    icon: FileArchive,
    accent: "yellow",
  },
  {
    id: "diagram",
    type: "image",
    title: "系统架构图 v1.0.png",
    summary: "PNG · 1920 × 1080",
    tags: [{ name: "设计", color: "purple" }],
    time: "5 小时前",
    icon: Image,
    accent: "purple",
  },
];

export const metrics: Metric[] = [
  { label: "全部记录", value: "432", delta: "较昨日 +28", tone: "cyan" },
  { label: "最近更新", value: "32", delta: "较昨日 +8", tone: "purple" },
  { label: "加密内容", value: "186", delta: "占全部 43%", tone: "yellow" },
  { label: "附件数量", value: "1,248", delta: "总大小 2.45 GB", tone: "blue" },
];

export const activities: Activity[] = [
  { title: "你更新了 项目需求文档（PRD）.pdf", detail: "文件资料", time: "2 分钟前", tone: "red" },
  { title: "你创建了笔记 桌面小窗交互", detail: "灵感", time: "21 分钟前", tone: "purple" },
  { title: "你上传了文件 接口规范 v2.1.xlsx", detail: "文件", time: "1 小时前", tone: "green" },
  { title: "你添加了标签 #架构 到 系统架构图 v1.0.png", detail: "标签", time: "3 小时前", tone: "blue" },
  { title: "你使用了链接 https://tauri.app/zh-cn/", detail: "链接", time: "5 小时前", tone: "cyan" },
];

export const commandRows = [
  { title: "/new note", desc: "新建笔记", keys: "Ctrl+N" },
  { title: "/new password", desc: "新建密码", keys: "Ctrl+P" },
  { title: "/sync", desc: "立即同步所有数据", keys: "Ctrl+S" },
  { title: "/lock", desc: "锁定应用", keys: "Ctrl+L" },
];

export const docRelations = [
  { icon: FileText, title: "项目启动资料", tag: "#项目" },
  { icon: Terminal, title: "服务器部署命令", tag: "#服务器" },
  { icon: Link, title: "Tauri 文档", tag: "#链接" },
  { icon: FileArchive, title: "项目需求文档（PRD）.pdf", tag: "#文档" },
];

export const vaultRecords = [
  { icon: KeyRound, title: "Github 账号", site: "github.com", user: "octocat", risk: "开放", tone: "purple" },
  { icon: BookOpen, title: "AWS Root", site: "console.aws.amazon.com", user: "root", risk: "高风险", tone: "yellow" },
  { icon: Terminal, title: "SSH 密钥 - 生产服务器", site: "prod.example.com", user: "ubuntu", risk: "生产", tone: "cyan" },
  { icon: Braces, title: "API Tokens - OpenAI", site: "platform.openai.com", user: "sk-••••••••", risk: "密钥", tone: "yellow" },
  { icon: FileText, title: "身份证资料", site: "id.gov.cn", user: "110************", risk: "重要", tone: "cyan" },
];
