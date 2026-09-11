# luci-app-cloudflared

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![OpenWrt Version](https://img.shields.io/badge/OpenWrt-21.02%20%7C%2022.03%20%7C%2023.05%20%7C%2024.10%2B-brightgreen.svg)](https://openwrt.org)
[![iStoreOS](https://img.shields.io/badge/iStoreOS-Supported-blue.svg)](https://istoreos.com)
[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/openif/luci-app-cloudflared/releases)

适用于 OpenWrt / iStoreOS 路由器的 Cloudflare 零信任隧道（Cloudflare Tunnel / `cloudflared`）LuCI Web 管理插件。

[简体中文](#简体中文) | [English](#english)

---

<a name="简体中文"></a>
## 简体中文

### 项目简介

`luci-app-cloudflared` 是一个运行在 OpenWrt 与 iStoreOS 上的 LuCI 界面插件。通过该插件，用户可以在路由器管理后台直接配置并运行 Cloudflare Tunnel 守护进程（`cloudflared`），将局域网内的内部服务（如路由 Web 后台、NAS、Home Assistant、本地服务器等）安全映射至外部域名，无需公网 IPv4 地址或路由器端口映射。

### 功能列表

- **双运行模式**：
  - **Token 模式（云端托管）**：直接使用 Cloudflare Zero Trust 控制台生成的单个 Token 运行隧道。
  - **本地配置模式**：支持读取本地配置文件（`/etc/cloudflared/config.yml`）及证书文件（`cert.pem`）。
- **服务状态监控**：
  - 实时显示守护进程运行状态（运行中 / 已停止）。
  - 显示当前进程 PID、`cloudflared` 客户端版本，以及已建立连接的 Cloudflare 边缘数据中心节点（如 `syd08`、`akl01`）。
  - 提供启动、停止、重启控制按钮。
- **活动隧道信息**：
  - 自动解析 Token 包含的 Account ID、Tunnel ID 及实时冗余连接信息。
- **运行日志管理**：
  - Web 端实时查看运行日志，支持自动滚动、行数筛选（100 / 200 / 500 行）与手动刷新。
  - 支持一键清空日志、复制日志至剪贴板及下载日志文件。
  - 内置日志大小检测逻辑：当日志超过 2MB 时自动截断保留最新 1500 行，避免占用过多 tmpfs 内存。
- **传输协议与安全设置**：
  - 支持选择传输协议（默认 HTTP/2，可选 QUIC 或 Auto）。
  - Token 输入框支持密码掩码与显隐切换；服务启动时通过进程环境变量注入 Token，避免在进程列表（`ps`）中明文显示。

### 安装方法

> [!NOTE]
> 本插件依赖 `cloudflared` 二进制程序。安装本插件前，请确保路由器已安装 `cloudflared`。在多数固件中可通过 `opkg update && opkg install cloudflared` 安装；若软件源中未提供或版本过低，可从 [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases) 下载对应架构的二进制文件放置于 `/usr/bin/cloudflared` 并赋予执行权限（`chmod +x /usr/bin/cloudflared`）。

#### 方法一：通过 Web 界面上传 IPK 安装
1. 前往本仓库 [Releases 页面](https://github.com/openif/luci-app-cloudflared/releases) 下载最新的 `.ipk` 文件。
2. 登录路由器后台，进入 **系统** > **软件包**（或 **iStore**）。
3. 点击 **上传软件包**，选择下载的 `.ipk` 文件并安装。
4. 安装完成后刷新页面，在 **服务** 菜单下即可看到 **Cloudflare 零信任隧道**。

#### 方法二：终端一键脚本安装
通过 SSH 登录路由器终端，执行以下命令安装：
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/openif/luci-app-cloudflared/main/install.sh)"
```

#### 方法三：命令行手动安装 IPK
前往 Releases 页面下载 `luci-app-cloudflared`（主程序）以及 `luci-i18n-cloudflared-zh-cn`（中文语言包，可选）：
```bash
scp luci-app-cloudflared_1.0.0-1_all.ipk luci-i18n-cloudflared-zh-cn_1.0.0-1_all.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "opkg update && opkg install /tmp/luci-app-cloudflared_*.ipk /tmp/luci-i18n-cloudflared-zh-cn_*.ipk"
```

### 使用步骤

1. **获取 Tunnel Token**：
   - 登录 [Cloudflare Zero Trust 控制台](https://one.dash.cloudflare.com/)。
   - 进入 **Networks** > **Tunnels**，点击 **Add a tunnel**。
   - 选择 **Cloudflare (cloudflared)**，输入隧道名称后点击 **Save tunnel**。
   - 在安装命令说明中，复制 `--token` 参数后的 Token 字符串。
   - 在 **Public Hostnames** 选项卡中，配置公共域名与内网目标地址映射（例如将 `router.yourdomain.com` 映射到 `HTTP` `192.168.1.1:80`）。
2. **在 LuCI 中配置**：
   - 打开路由器后台 **服务** > **Cloudflare 零信任隧道**。
   - 勾选 **启用**，模式选择 **Token 模式**，将复制的 Token 粘贴至输入框。
   - 协议默认推荐选择 **HTTP/2**。
   - 点击 **保存并应用**。
3. **查看状态**：
   - 等待几秒后，页面顶部状态将显示为绿色的 **运行中** 及已连接的边缘节点。
   - 此时即可通过外网访问在 Cloudflare 配置的公共域名。

### 说明与常见问题

- **为什么默认推荐 HTTP/2 协议？**
  - QUIC 基于 UDP 协议，部分网络环境下对大流量或长连接 UDP 存在 QoS 限制或丢包；HTTP/2 使用标准 TCP 443 端口，在多数网络环境下的连接稳定性较好。
- **开机是否自启？**
  - 是。插件通过 OpenWrt procd 注册为系统服务，路由器重启后会自动启动，网络重连后会自动恢复连接。
- **日志存储机制**：
  - 默认写入 `/var/log/cloudflared.log`（内存文件系统）。服务每次启动和日常运行时会监控文件大小，单文件超过 2MB 时会自动保留最新 1500 行，以避免耗尽内存。

### 源码编译

```bash
cd package/
git clone https://github.com/openif/luci-app-cloudflared.git
cd ..
make menuconfig # 选择 LuCI -> Applications -> luci-app-cloudflared
make package/luci-app-cloudflared/compile V=s
```

---

<a name="english"></a>
## English

### Overview

`luci-app-cloudflared` is an OpenWrt / iStoreOS LuCI web interface plugin for Cloudflare Tunnel (`cloudflared`). It enables users to configure, run, and monitor Cloudflare Zero Trust tunnels directly from the LuCI web interface, exposing internal services (such as router Web UI, NAS, Home Assistant, and local servers) to external domains without requiring public IPv4 addresses or router port forwarding.

### Features

- **Dual Operation Modes**:
  - **Token Mode (Cloud-Managed)**: Run tunnels directly with a single token generated from the Cloudflare Zero Trust dashboard.
  - **Local Config Mode**: Supports reading local configuration files (`/etc/cloudflared/config.yml`) and certificates (`cert.pem`).
- **Service Monitoring**:
  - Displays daemon status (Running / Stopped).
  - Displays current process PID, `cloudflared` binary version, and connected Cloudflare edge data centers (e.g. `syd08`, `akl01`).
  - Provides Start, Stop, and Restart controls.
- **Active Tunnel Details**:
  - Parses Account ID, Tunnel ID, and live edge connections from active tunnel data.
- **Runtime Log Management**:
  - Embedded web log viewer with auto-scroll, line limit selection (100 / 200 / 500 lines), and manual refresh.
  - One-click clear log, copy to clipboard, and log file download.
  - Automatic log rotation: Truncates log files when exceeding 2MB to keep the last 1500 lines, preventing memory exhaustion on RAM-backed `/var/log`.
- **Transport Protocol & Security**:
  - Configurable transport protocols (`HTTP/2`, `QUIC`, `auto`).
  - Token input masked with reveal toggle; tokens are injected into the daemon via process environment variables to prevent leakage in process tables (`ps`).

### Installation

> [!NOTE]
> This package requires the `cloudflared` binary. Ensure `cloudflared` is installed before using this plugin. In most firmwares, install via `opkg update && opkg install cloudflared`. If unavailable in your software feeds, download the official binary for your architecture from [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases) and place it in `/usr/bin/cloudflared` (`chmod +x /usr/bin/cloudflared`).

#### Method 1: Web Upload via LuCI / iStore
1. Download the latest `.ipk` release package from [GitHub Releases](https://github.com/openif/luci-app-cloudflared/releases).
2. Go to **System** > **Software** (or open **iStore**) in the LuCI interface.
3. Click **Upload Package...**, select the `.ipk` file, and proceed with the installation.
4. Refresh the page to access **Cloudflare Zero Trust Tunnel** under the Services menu.

#### Method 2: Terminal Online Script Install
Log in via SSH and run:
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/openif/luci-app-cloudflared/main/install.sh)"
```

#### Method 3: Command Line IPK Install
Download the `luci-app-cloudflared` package (and optional `luci-i18n-cloudflared-zh-cn` language pack) from Releases:
```bash
scp luci-app-cloudflared_1.0.0-1_all.ipk root@192.168.1.1:/tmp/
# Optional: install Simplified Chinese translation pack:
# scp luci-i18n-cloudflared-zh-cn_1.0.0-1_all.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "opkg update && opkg install /tmp/luci-app-cloudflared_*.ipk"
```

### Usage Guide

1. **Obtain Tunnel Token**:
   - Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
   - Navigate to **Networks** > **Tunnels**, click **Add a tunnel**.
   - Select **Cloudflare (cloudflared)**, name the tunnel, and click **Save tunnel**.
   - Copy the token string following `--token` in the command instructions.
   - In the **Public Hostnames** tab, map your domain to the local service address (e.g., `router.yourdomain.com` -> `HTTP` `192.168.1.1:80`).
2. **Configure in LuCI**:
   - Go to **Services** > **Cloudflare Zero Trust Tunnel**.
   - Check **Enable**, select **Token Mode**, and paste the token into the Tunnel Token field.
   - Keep protocol as **HTTP/2**.
   - Click **Save & Apply**.
3. **Verify Status**:
   - Within seconds, the status header will indicate **Running** with connected edge data center codes.
   - You can now access your internal service via the configured domain.

### Notes & FAQ

- **Why is HTTP/2 recommended by default?**
  - QUIC operates over UDP, which may encounter QoS rate-limiting or packet drop on some residential ISPs. HTTP/2 uses standard TCP 443, offering consistent connection stability in most network environments.
- **Does it start automatically on boot?**
  - Yes. The service is registered with OpenWrt's procd init system and starts automatically upon system boot or network re-connection.
- **Log Management**:
  - Logs are written to `/var/log/cloudflared.log` by default. The init script checks file size and truncates logs larger than 2MB to keep the last 1500 lines, ensuring safe memory usage.

### Building from Source

```bash
cd package/
git clone https://github.com/openif/luci-app-cloudflared.git
cd ..
make menuconfig # Select LuCI -> Applications -> luci-app-cloudflared
make package/luci-app-cloudflared/compile V=s
```

### License

Licensed under the [Apache License 2.0](LICENSE).